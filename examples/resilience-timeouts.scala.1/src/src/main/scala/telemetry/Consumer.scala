package telemetry

import cats.effect.IO
import fs2.Stream

import scala.concurrent.duration._

trait BatchSource {
  def batches: Stream[IO, (List[RawReading], IO[Unit])]
}

object Consumer {

  def run(source: BatchSource, ingest: IngestService): Stream[IO, Unit] =
    source.batches.evalMap { case (batch, commit) =>
      ingest.ingest(batch).attempt.flatMap {
        case Right(_) => commit
        case Left(_)  => IO.sleep(1.second)
      }
    }
}
