#pragma once

#include <atomic>
#include <cstdint>
#include <utility>

namespace vstream {

class StreamLimiter {
 public:
  explicit StreamLimiter(int32_t max_streams) : max_streams_(max_streams) {}

  bool try_acquire() {
    if (active_.load(std::memory_order_acquire) >= max_streams_) {
      rejected_.fetch_add(1, std::memory_order_relaxed);
      return false;
    }
    active_.fetch_add(1, std::memory_order_acq_rel);
    return true;
  }

  void release() { active_.fetch_sub(1, std::memory_order_acq_rel); }

  int32_t active() const { return active_.load(std::memory_order_acquire); }
  uint64_t rejected() const { return rejected_.load(std::memory_order_relaxed); }

 private:
  const int32_t max_streams_;
  std::atomic<int32_t> active_{0};
  std::atomic<uint64_t> rejected_{0};
};

class StreamPermit {
 public:
  explicit StreamPermit(StreamLimiter& limiter) : limiter_(&limiter) {}
  StreamPermit(StreamPermit&& other) noexcept
      : limiter_(std::exchange(other.limiter_, nullptr)) {}
  StreamPermit(const StreamPermit&) = delete;
  StreamPermit& operator=(const StreamPermit&) = delete;
  StreamPermit& operator=(StreamPermit&&) = delete;

  ~StreamPermit() {
    if (limiter_ != nullptr) {
      limiter_->release();
    }
  }

 private:
  StreamLimiter* limiter_;
};

}  // namespace vstream
