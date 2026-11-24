package com.acme.support.events

final case class TicketEvent(
    ticketId: String,
    agentId: String,
    seq: Long,
    kind: String,
    body: String
)

object TicketEvent {
  def toJson(e: TicketEvent): String =
    ujson.write(
      ujson.Obj(
        "ticketId" -> e.ticketId,
        "agentId" -> e.agentId,
        "seq" -> e.seq,
        "kind" -> e.kind,
        "body" -> e.body
      )
    )

  def fromJson(s: String): TicketEvent = {
    val j = ujson.read(s)
    TicketEvent(j("ticketId").str, j("agentId").str, j("seq").num.toLong, j("kind").str, j("body").str)
  }
}
