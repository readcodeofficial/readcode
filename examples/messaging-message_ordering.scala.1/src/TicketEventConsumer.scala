package com.acme.support.events

import java.time.Duration
import java.util.Properties
import org.apache.kafka.clients.consumer.{ConsumerConfig, KafkaConsumer}
import org.apache.kafka.common.serialization.StringDeserializer
import scala.concurrent.duration._
import scala.concurrent.{Await, ExecutionContext, Future}
import scala.jdk.CollectionConverters._

trait TicketStore {
  def lastAppliedSeq(ticketId: String): Long
  def apply(event: TicketEvent): Unit
}

class TicketEventConsumer(bootstrap: String, topic: String, store: TicketStore)(implicit ec: ExecutionContext) {
  private val props = new Properties()
  props.put(ConsumerConfig.BOOTSTRAP_SERVERS_CONFIG, bootstrap)
  props.put(ConsumerConfig.GROUP_ID_CONFIG, "ticket-projector")
  props.put(ConsumerConfig.ENABLE_AUTO_COMMIT_CONFIG, "false")
  props.put(ConsumerConfig.KEY_DESERIALIZER_CLASS_CONFIG, classOf[StringDeserializer].getName)
  props.put(ConsumerConfig.VALUE_DESERIALIZER_CLASS_CONFIG, classOf[StringDeserializer].getName)
  props.put(ConsumerConfig.MAX_POLL_RECORDS_CONFIG, "200")

  private val consumer = new KafkaConsumer[String, String](props)
  @volatile private var running = true

  def run(): Unit = {
    consumer.subscribe(java.util.List.of(topic))
    while (running) {
      val records = consumer.poll(Duration.ofMillis(500)).asScala.toList
      if (records.nonEmpty) {
        val events = records.map(r => TicketEvent.fromJson(r.value()))
        val byTicket = events.groupBy(_.ticketId)

        val work = byTicket.values.map { perTicket =>
          perTicket.foldLeft(Future.unit) { (prev, event) =>
            prev.map(_ => applyIfNewer(event))
          }
        }
        Await.result(Future.sequence(work), 30.seconds)
        consumer.commitSync()
      }
    }
    consumer.close()
  }

  private def applyIfNewer(event: TicketEvent): Unit =
    if (event.seq > store.lastAppliedSeq(event.ticketId)) {
      store.apply(event)
    }

  def stop(): Unit = running = false
}
