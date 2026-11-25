package com.helpdesk.tickets.view

import java.time.Duration
import java.time.Instant

enum class Priority(val maxFirstResponse: Duration) {
    LOW(Duration.ofHours(24)),
    NORMAL(Duration.ofHours(8)),
    URGENT(Duration.ofHours(1)),
}

enum class Tier { STANDARD, PREMIUM }

data class Ticket(
    val id: String,
    val customerId: String,
    val subject: String,
    val priority: Priority,
    val createdAt: Instant,
)

data class CustomerProfile(val id: String, val name: String, val tier: Tier) {
    companion object {
        fun anonymous(id: String) = CustomerProfile(id, "Unknown customer", Tier.STANDARD)
    }
}

data class Article(val id: String, val title: String, val url: String)
data class SlaPolicy(val firstResponse: Duration)

data class TicketView(
    val ticket: Ticket,
    val customer: CustomerProfile,
    val suggestedArticles: List<Article>,
    val respondBy: Instant,
    val degradedSections: List<String>,
)

data class Fetched<T>(val value: T, val degraded: Boolean)
data class CacheEntry<T>(val value: T, val expiresAt: Instant)

data class ViewConfig(
    val crmTimeoutMs: Long = 400,
    val kbTimeoutMs: Long = 300,
    val slaTimeoutMs: Long = 250,
    val profileTtl: Duration = Duration.ofMinutes(10),
    val fallbackFirstResponse: Duration = Duration.ofHours(4),
)

class TicketNotFoundException(id: String) : RuntimeException("Ticket $id not found")

interface TicketRepository { suspend fun findById(id: String): Ticket? }
interface CrmClient { suspend fun profile(customerId: String): CustomerProfile }
interface KnowledgeBaseClient { suspend fun search(query: String, limit: Int): List<Article> }
interface SlaPolicyClient { suspend fun policyFor(customerId: String, priority: Priority): SlaPolicy }
