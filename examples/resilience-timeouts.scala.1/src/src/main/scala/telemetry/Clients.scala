package telemetry

import cats.effect.IO

final case class DeviceId(value: String) extends AnyVal

final case class DeviceInfo(id: DeviceId, site: String, firmware: String, calibration: Double)

final case class RawReading(deviceId: DeviceId, ts: Long, value: Double)

final case class Reading(deviceId: DeviceId, ts: Long, value: Double, site: String, stale: Boolean)

trait DeviceRegistry {
  def lookup(id: DeviceId): IO[Option[DeviceInfo]]
}

trait CalibrationService {
  def offsetFor(id: DeviceId, firmware: String): IO[Double]
}

trait TimeSeriesSink {
  def write(batch: List[Reading]): IO[Unit]
}

trait Metrics {
  def increment(name: String, tags: (String, String)*): IO[Unit]
}
