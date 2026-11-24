#include <atomic>
#include <chrono>
#include <cstddef>
#include <cstdint>
#include <optional>
#include <string>
#include <thread>
#include <vector>

#include "limiter.h"
#include "metrics.h"

namespace vstream {

struct SegmentRequest {
  std::string stream_id;
  uint64_t media_time_ms;
  std::size_t bytes;
};

struct SegmentReceipt {
  uint64_t sequence;
  bool advanced_live_edge;
};

class IngestService {
 public:
  explicit IngestService(int32_t max_streams) : limiter_(max_streams) {}

  std::optional<StreamPermit> open_stream() {
    if (!limiter_.try_acquire()) {
      return std::nullopt;
    }
    return StreamPermit(limiter_);
  }

  SegmentReceipt accept_segment(const SegmentRequest& req) {
    SegmentReceipt receipt;
    receipt.sequence = sequencer_.next();
    receipt.advanced_live_edge = live_edge_.advance(req.media_time_ms);
    bytes_in_.fetch_add(req.bytes, std::memory_order_relaxed);
    segments_in_.fetch_add(1, std::memory_order_relaxed);
    return receipt;
  }

  IngestStats snapshot() const {
    IngestStats s;
    s.segments = segments_in_.load(std::memory_order_relaxed);
    s.bytes = bytes_in_.load(std::memory_order_relaxed);
    s.active_streams = limiter_.active();
    s.rejected_streams = limiter_.rejected();
    s.newest_media_time_ms = live_edge_.get();
    return s;
  }

 private:
  StreamLimiter limiter_;
  SegmentSequencer sequencer_;
  HighWaterMark live_edge_;
  std::atomic<uint64_t> bytes_in_{0};
  std::atomic<uint64_t> segments_in_{0};
};

void run_publisher(IngestService& service, const std::string& stream_id,
                   int segments) {
  auto permit = service.open_stream();
  if (!permit) {
    return;
  }
  uint64_t media_time_ms = 0;
  for (int i = 0; i < segments; ++i) {
    media_time_ms += 2000;
    service.accept_segment({stream_id, media_time_ms, 188 * 1024});
    std::this_thread::sleep_for(std::chrono::milliseconds(2));
  }
}

}  // namespace vstream
