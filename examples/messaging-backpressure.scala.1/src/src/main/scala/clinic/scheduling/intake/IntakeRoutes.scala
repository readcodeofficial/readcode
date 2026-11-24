package clinic.scheduling.intake

import akka.http.scaladsl.model.{ HttpResponse, StatusCodes }
import akka.http.scaladsl.model.headers.`Retry-After`
import akka.http.scaladsl.server.Directives._
import akka.http.scaladsl.server.Route
import spray.json._

import java.time.Instant
import java.util.UUID

object IntakeRoutes extends DefaultJsonProtocol {
  final case class BookingBody(patientId: String, clinicianId: String, slotStart: Instant)

  implicit val instantFormat: JsonFormat[Instant] = new JsonFormat[Instant] {
    def write(i: Instant): JsValue = JsString(i.toString)
    def read(v: JsValue): Instant = v match {
      case JsString(s) => Instant.parse(s)
      case other       => deserializationError(s"expected ISO instant, got $other")
    }
  }
  implicit val bodyFormat: RootJsonFormat[BookingBody] = jsonFormat3(BookingBody.apply)

  def routes(intake: BookingIntake): Route =
    path("bookings") {
      post {
        entity(as[BookingBody]) { body =>
          val req = BookingRequest(UUID.randomUUID().toString, body.patientId, body.clinicianId, body.slotStart)
          onSuccess(intake.submit(req)) {
            case IntakeOutcome.Accepted =>
              complete(StatusCodes.Accepted, JsObject("requestId" -> JsString(req.requestId)))
            case IntakeOutcome.Shed =>
              respondWithHeader(`Retry-After`(5)) {
                complete(StatusCodes.TooManyRequests, JsObject("error" -> JsString("intake saturated")))
              }
            case IntakeOutcome.Unavailable =>
              complete(HttpResponse(StatusCodes.ServiceUnavailable))
          }
        }
      }
    }
}
