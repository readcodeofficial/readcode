package com.acme.support.events

import java.util.Properties
import org.apache.kafka.clients.producer.{KafkaProducer, ProducerConfig, ProducerRecord, RecordMetadata}
import org.apache.kafka.common.serialization.StringSerializer
import scala.concurrent.{Future, Promise}

class TicketEventPublisher(bootstrap: String, topic: String) {
  private val props = new Properties()
  props.put(ProducerConfig.BOOTSTRAP_SERVERS_CONFIG, bootstrap)
  props.put(ProducerConfig.KEY_SERIALIZER_CLASS_CONFIG, classOf[StringSerializer].getName)
  props.put(ProducerConfig.VALUE_SERIALIZER_CLASS_CONFIG, classOf[StringSerializer].getName)
  props.put(ProducerConfig.ENABLE_IDEMPOTENCE_CONFIG, "true")
  props.put(ProducerConfig.ACKS_CONFIG, "all")

  private val producer = new KafkaProducer[String, String](props)

  def publish(event: TicketEvent): Future[RecordMetadata] = {
    val promise = Promise[RecordMetadata]()
    val payload = TicketEvent.toJson(event)
    val record = new ProducerRecord[String, String](topic, event.agentId, payload)
    producer.send(
      record,
      (md: RecordMetadata, err: Exception) =>
        if (err != null) promise.failure(err) else promise.success(md)
    )
    promise.future
  }

  def close(): Unit = producer.close()
}
