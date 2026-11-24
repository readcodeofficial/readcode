#pragma once

#include <atomic>
#include <cstdint>

namespace vstream {

class SegmentSequencer {
 public:
  uint64_t next() { return counter_.fetch_add(1, std::memory_order_relaxed) + 1; }

 private:
  std::atomic<uint64_t> counter_{0};
};

class HighWaterMark {
 public:
  bool advance(uint64_t candidate) {
    uint64_t current = value_.load(std::memory_order_relaxed);
    while (candidate > current) {
      if (value_.compare_exchange_weak(current, candidate,
                                       std::memory_order_acq_rel,
                                       std::memory_order_relaxed)) {
        return true;
      }
    }
    return false;
  }

  uint64_t get() const { return value_.load(std::memory_order_acquire); }

 private:
  std::atomic<uint64_t> value_{0};
};

struct IngestStats {
  uint64_t segments;
  uint64_t bytes;
  int32_t active_streams;
  uint64_t rejected_streams;
  uint64_t newest_media_time_ms;
};

}  // namespace vstream
