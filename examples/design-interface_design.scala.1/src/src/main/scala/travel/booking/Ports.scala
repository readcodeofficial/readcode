package travel.booking

import java.time.Instant
import scala.concurrent.duration.FiniteDuration

final case class FlightId(value: String) extends AnyVal
final case class Money(minorUnits: Long, currency: String)
final case class Passenger(name: String, passportNumber: String)

final case class BookingRequest(flight: FlightId, passengers: List[Passenger], total: Money)
final case class SeatHold(id: String, flight: FlightId, seats: Int, expiresAt: Instant)
final case class PaymentReceipt(id: String, amount: Money)
final case class Booking(reference: String, flight: FlightId, passengers: List[Passenger], paid: Money)

sealed trait HoldFailure
object HoldFailure {
  case object SoldOut extends HoldFailure
  final case class Unavailable(cause: Throwable) extends HoldFailure
}

sealed trait CommitFailure
object CommitFailure {
  case object HoldExpired extends CommitFailure
  final case class Unavailable(cause: Throwable) extends CommitFailure
}

sealed trait PaymentFailure
object PaymentFailure {
  final case class Declined(reason: String) extends PaymentFailure
  final case class Unavailable(cause: Throwable) extends PaymentFailure
}

sealed trait BookingError
object BookingError {
  case object NotEnoughSeats extends BookingError
  case object HoldExpired extends BookingError
  final case class PaymentDeclined(reason: String) extends BookingError
  case object TryAgain extends BookingError
}

/** Failure values never leave a hold, charge or commit half-applied: Unavailable means nothing happened. */
trait SeatInventory {
  def hold(flight: FlightId, seats: Int, ttl: FiniteDuration): Either[HoldFailure, SeatHold]

  /** Safe to call for holds that were committed, expired or never existed. */
  def release(hold: SeatHold): Unit

  def commit(hold: SeatHold, reference: String): Either[CommitFailure, Unit]
}

trait PaymentGateway {
  /** The reference doubles as the idempotency key: charging twice with it charges once. */
  def charge(idempotencyKey: String, amount: Money): Either[PaymentFailure, PaymentReceipt]

  def refund(receipt: PaymentReceipt): Either[PaymentFailure, Unit]
}

trait ReferenceGenerator {
  def next(): String
}

trait ManualReview {
  def flagUnrefunded(receipt: PaymentReceipt, reason: String): Unit
}
