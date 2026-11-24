package travel.booking

import scala.concurrent.duration.FiniteDuration

final class BookingService(
    inventory: SeatInventory,
    payments: PaymentGateway,
    references: ReferenceGenerator,
    review: ManualReview,
    holdTtl: FiniteDuration
) {

  def book(request: BookingRequest): Either[BookingError, Booking] = {
    val reference = references.next()
    inventory.hold(request.flight, request.passengers.size, holdTtl) match {
      case Left(failure) =>
        Left(fromHold(failure))
      case Right(hold) =>
        val outcome = payAndCommit(request, reference, hold)
        if (outcome.isLeft) inventory.release(hold)
        outcome
    }
  }

  private def payAndCommit(
      request: BookingRequest,
      reference: String,
      hold: SeatHold
  ): Either[BookingError, Booking] =
    payments.charge(reference, request.total) match {
      case Left(PaymentFailure.Declined(reason)) =>
        Left(BookingError.PaymentDeclined(reason))
      case Left(PaymentFailure.Unavailable(_)) =>
        Left(BookingError.TryAgain)
      case Right(receipt) =>
        inventory.commit(hold, reference) match {
          case Right(_) =>
            Right(Booking(reference, request.flight, request.passengers, receipt.amount))
          case Left(failure) =>
            refundOrFlag(receipt)
            Left(fromCommit(failure))
        }
    }

  private def refundOrFlag(receipt: PaymentReceipt): Unit =
    payments.refund(receipt) match {
      case Right(_) => ()
      case Left(PaymentFailure.Declined(reason)) => review.flagUnrefunded(receipt, reason)
      case Left(PaymentFailure.Unavailable(cause)) =>
        review.flagUnrefunded(receipt, s"gateway unavailable: ${cause.getMessage}")
    }

  private def fromHold(failure: HoldFailure): BookingError = failure match {
    case HoldFailure.SoldOut        => BookingError.NotEnoughSeats
    case HoldFailure.Unavailable(_) => BookingError.TryAgain
  }

  private def fromCommit(failure: CommitFailure): BookingError = failure match {
    case CommitFailure.HoldExpired    => BookingError.HoldExpired
    case CommitFailure.Unavailable(_) => BookingError.TryAgain
  }
}
