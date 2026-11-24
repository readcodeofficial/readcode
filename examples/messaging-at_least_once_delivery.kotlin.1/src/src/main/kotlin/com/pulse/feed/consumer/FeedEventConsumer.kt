package com.pulse.feed.consumer

import org.apache.kafka.clients.consumer.ConsumerRecords
import org.apache.kafka.clients.consumer.KafkaConsumer
import org.apache.kafka.clients.consumer.OffsetAndMetadata
import org.apache.kafka.common.TopicPartition
import org.apache.kafka.common.errors.WakeupException
import org.slf4j.LoggerFactory
import java.time.Duration

class FeedEventConsumer(
    private val consumer: KafkaConsumer<String, String>,
    private val processor: FeedEventProcessor,
    private val topic: String,
    private val retryPause: Duration = Duration.ofSeconds(1),
) : Runnable {

    private val log = LoggerFactory.getLogger(FeedEventConsumer::class.java)

    @Volatile
    private var running = true

    fun stop() {
        running = false
        consumer.wakeup()
    }

    override fun run() {
        consumer.subscribe(listOf(topic))
        try {
            while (running) {
                val records = consumer.poll(Duration.ofMillis(500))
                if (records.isEmpty) continue
                try {
                    handleBatch(records)
                    consumer.commitSync(nextOffsets(records))
                } catch (e: WakeupException) {
                    throw e
                } catch (e: Exception) {
                    log.warn("batch of {} records failed, rewinding", records.count(), e)
                    rewind(records.partitions())
                    Thread.sleep(retryPause.toMillis())
                }
            }
        } catch (_: WakeupException) {
            log.info("consumer woken up, shutting down")
        } finally {
            consumer.close()
        }
    }

    private fun handleBatch(records: ConsumerRecords<String, String>) {
        for (record in records) {
            processor.process(record.key(), record.value())
        }
    }

    private fun nextOffsets(records: ConsumerRecords<String, String>): Map<TopicPartition, OffsetAndMetadata> =
        records.partitions().associateWith { tp ->
            OffsetAndMetadata(records.records(tp).last().offset() + 1)
        }

    private fun rewind(partitions: Set<TopicPartition>) {
        val committed = consumer.committed(partitions)
        for (tp in partitions) {
            val offset = committed[tp]?.offset()
            if (offset != null) consumer.seek(tp, offset) else consumer.seekToBeginning(listOf(tp))
        }
    }
}
