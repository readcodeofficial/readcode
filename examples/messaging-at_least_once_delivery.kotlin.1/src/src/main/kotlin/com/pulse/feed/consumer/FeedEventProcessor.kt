package com.pulse.feed.consumer

import com.fasterxml.jackson.databind.ObjectMapper
import com.fasterxml.jackson.module.kotlin.readValue

data class PostPublished(
    val eventId: String,
    val authorId: Long,
    val postId: Long,
    val publishedAtMs: Long,
)

interface ProcessedEventStore {
    /** Atomically records the event id; returns false if it was already recorded. */
    fun markIfNew(eventId: String): Boolean
}

interface FollowerGraph {
    fun followersOf(authorId: Long): List<Long>
}

interface TimelineStore {
    fun insert(userId: Long, postId: Long, publishedAtMs: Long)
}

class FeedEventProcessor(
    private val mapper: ObjectMapper,
    private val processed: ProcessedEventStore,
    private val followers: FollowerGraph,
    private val timelines: TimelineStore,
) {

    fun process(key: String?, payload: String) {
        val event: PostPublished = mapper.readValue(payload)

        if (!processed.markIfNew(event.eventId)) return

        for (followerId in followers.followersOf(event.authorId)) {
            timelines.insert(followerId, event.postId, event.publishedAtMs)
        }
    }
}
