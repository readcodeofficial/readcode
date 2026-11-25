package com.helpdesk.tickets.view

import io.github.resilience4j.circuitbreaker.CallNotPermittedException
import io.github.resilience4j.circuitbreaker.CircuitBreaker
import io.github.resilience4j.kotlin.circuitbreaker.executeSuspendFunction
import java.io.IOException
import java.time.Clock
import java.time.Instant
import java.util.concurrent.ConcurrentHashMap
import kotlinx.coroutines.async
import kotlinx.coroutines.coroutineScope
import kotlinx.coroutines.withTimeoutOrNull
import org.slf4j.LoggerFactory

class TicketViewService(
    private val tickets: TicketRepository,
    private val crm: CrmClient,
    private val knowledgeBase: KnowledgeBaseClient,
    private val slaPolicies: SlaPolicyClient,
    private val kbBreaker: CircuitBreaker,
    private val clock: Clock,
    private val config: ViewConfig = ViewConfig(),
) {
    private val log = LoggerFactory.getLogger(TicketViewService::class.java)
    private val profileCache = ConcurrentHashMap<String, CacheEntry<CustomerProfile>>()

    suspend fun view(ticketId: String): TicketView {
        val ticket = tickets.findById(ticketId) ?: throw TicketNotFoundException(ticketId)

        return coroutineScope {
            val profile = async { customerProfile(ticket.customerId) }
            val articles = async { suggestedArticles(ticket) }
            val sla = async { slaDeadline(ticket) }

            val p = profile.await()
            val a = articles.await()
            val s = sla.await()

            TicketView(
                ticket = ticket,
                customer = p.value,
                suggestedArticles = a.value,
                respondBy = s.value,
                degradedSections = buildList {
                    if (p.degraded) add("customer")
                    if (a.degraded) add("articles")
                    if (s.degraded) add("sla")
                },
            )
        }
    }

    private suspend fun customerProfile(customerId: String): Fetched<CustomerProfile> {
        val cached = profileCache[customerId]
        if (cached != null && cached.expiresAt.isAfter(clock.instant())) {
            return Fetched(cached.value, degraded = false)
        }

        val fresh = try {
            withTimeoutOrNull(config.crmTimeoutMs) { crm.profile(customerId) }
        } catch (e: IOException) {
            log.warn("CRM lookup failed for customer {}: {}", customerId, e.message)
            null
        }

        val profile = fresh ?: CustomerProfile.anonymous(customerId)
        profileCache[customerId] = CacheEntry(profile, clock.instant().plus(config.profileTtl))
        return Fetched(profile, degraded = fresh == null)
    }

    private suspend fun suggestedArticles(ticket: Ticket): Fetched<List<Article>> {
        return try {
            val hits = withTimeoutOrNull(config.kbTimeoutMs) {
                kbBreaker.executeSuspendFunction { knowledgeBase.search(ticket.subject, limit = 5) }
            }
            if (hits == null) {
                log.warn("Knowledge base search timed out for ticket {}", ticket.id)
                Fetched(emptyList(), degraded = true)
            } else {
                Fetched(hits, degraded = false)
            }
        } catch (e: CallNotPermittedException) {
            Fetched(emptyList(), degraded = true)
        } catch (e: IOException) {
            log.warn("Knowledge base search failed for ticket {}: {}", ticket.id, e.message)
            Fetched(emptyList(), degraded = true)
        }
    }

    private suspend fun slaDeadline(ticket: Ticket): Fetched<Instant> {
        val policy = try {
            withTimeoutOrNull(config.slaTimeoutMs) { slaPolicies.policyFor(ticket.customerId, ticket.priority) }
        } catch (e: IOException) {
            null
        }
        if (policy != null) {
            return Fetched(ticket.createdAt.plus(policy.firstResponse), degraded = false)
        }
        val conservative = minOf(config.fallbackFirstResponse, ticket.priority.maxFirstResponse)
        return Fetched(ticket.createdAt.plus(conservative), degraded = true)
    }
}
