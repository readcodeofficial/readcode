package telemetry

import cats.effect.IO
import cats.syntax.all._
import org.typelevel.log4cats.Logger

import scala.concurrent.duration._

final case class IngestConfig(
    calibrationTimeout: FiniteDuration = 150.millis,
    sinkTimeout: FiniteDuration = 2.seconds,
    parallelism: Int = 16
)

final class IngestService(
    registry: DeviceRegistry,
    calibration: CalibrationService,
    sink: TimeSeriesSink,
    metrics: Metrics,
    cfg: IngestConfig
)(implicit log: Logger[IO]) {

  def ingest(batch: List[RawReading]): IO[Int] =
    for {
      readings <- batch.parTraverseN(cfg.parallelism)(enrich)
      accepted = readings.flatten
      _ <- writeBatch(accepted)
      _ <- metrics.increment("ingest.dropped", "reason" -> "unknown_device")
             .replicateA_(batch.size - accepted.size)
    } yield accepted.size

  private def enrich(raw: RawReading): IO[Option[Reading]] =
    registry.lookup(raw.deviceId).flatMap {
      case None => IO.pure(None)
      case Some(info) =>
        offsetOrStale(info).map { case (offset, stale) =>
          Some(Reading(raw.deviceId, raw.ts, raw.value * info.calibration + offset, info.site, stale))
        }
    }

  private def offsetOrStale(info: DeviceInfo): IO[(Double, Boolean)] =
    calibration
      .offsetFor(info.id, info.firmware)
      .timeout(cfg.calibrationTimeout)
      .map(offset => (offset, false))
      .handleErrorWith { err =>
        log.warn(err)(s"calibration unavailable for ${info.id.value}, using stale value") *>
          metrics.increment("ingest.calibration_fallback").as((0.0, true))
      }

  private def writeBatch(readings: List[Reading]): IO[Unit] =
    if (readings.isEmpty) IO.unit
    else
      sink
        .write(readings)
        .timeout(cfg.sinkTimeout)
        .onError { case err => log.error(err)(s"sink write failed for ${readings.size} readings") }
}
