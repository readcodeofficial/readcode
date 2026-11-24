package clinic.scheduling.intake

import java.time.Instant

import akka.actor.ActorSystem
import akka.stream.{ Materializer, OverflowStrategy, QueueOfferResult }
import akka.stream.scaladsl.{ Flow, Keep, Sink, Source, SourceQueueWithComplete }

import scala.concurrent.Future
import scala.concurrent.duration._
import scala.util.control.NonFatal

final case class BookingRequest(
    requestId: String,
    patientId: String,
    clinicianId: String,
    slotStart: Instant
)

sealed trait IntakeOutcome
object IntakeOutcome {
  case object Accepted extends IntakeOutcome
  case object Shed extends IntakeOutcome
  case object Unavailable extends IntakeOutcome
}

trait SlotService { def reserve(req: BookingRequest): Future[Unit] }
trait Notifier { def confirm(req: BookingRequest): Future[Unit] }
trait ParkedRequests { def park(req: BookingRequest, cause: Throwable): Future[Unit] }

final class BookingIntake(
    slots: SlotService,
    notifier: Notifier,
    parked: ParkedRequests,
    bufferSize: Int = 512,
    reserveParallelism: Int = 8,
    notifyPerSecond: Int = 50
)(implicit system: ActorSystem) {

  private implicit val mat: Materializer = Materializer(system)
  import system.dispatcher

  private val reserve: Flow[BookingRequest, BookingRequest, _] =
    Flow[BookingRequest]
      .mapAsync(reserveParallelism) { req =>
        slots
          .reserve(req)
          .map(_ => Option(req))
          .recoverWith {
            case NonFatal(e) =>
              system.log.warning("reserve failed for {}: {}", req.requestId, e.getMessage)
              parked.park(req, e).map(_ => Option.empty[BookingRequest])
          }
      }
      .collect { case Some(req) => req }

  private val queue: SourceQueueWithComplete[BookingRequest] =
    Source
      .queue[BookingRequest](bufferSize, OverflowStrategy.dropHead)
      .via(reserve)
      .throttle(notifyPerSecond, 1.second)
      .mapAsync(2)(notifier.confirm)
      .toMat(Sink.ignore)(Keep.left)
      .run()

  def submit(req: BookingRequest): Future[IntakeOutcome] =
    queue.offer(req).map {
      case QueueOfferResult.Enqueued => IntakeOutcome.Accepted
      case QueueOfferResult.Dropped  => IntakeOutcome.Shed
      case _                         => IntakeOutcome.Unavailable
    }

  def shutdown(): Future[Unit] = {
    queue.complete()
    queue.watchCompletion().map(_ => ())
  }
}
