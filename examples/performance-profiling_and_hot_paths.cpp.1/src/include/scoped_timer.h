#pragma once

#include <array>
#include <atomic>
#include <chrono>
#include <cstddef>
#include <cstdint>

namespace vstream {

// Power-of-two latency histogram: bucket i counts samples in [2^i, 2^(i+1)) microseconds.
class LatencyHistogram {
public:
    static constexpr std::size_t kBuckets = 16;

    void record(std::chrono::nanoseconds elapsed) noexcept {
        std::uint64_t us = static_cast<std::uint64_t>(elapsed.count() / 1000);
        std::size_t idx = 0;
        while (us > 1 && idx + 1 < kBuckets) {
            us >>= 1;
            ++idx;
        }
        buckets_[idx].fetch_add(1, std::memory_order_relaxed);
    }

    std::uint64_t count(std::size_t bucket) const noexcept {
        return buckets_[bucket].load(std::memory_order_relaxed);
    }

private:
    std::array<std::atomic<std::uint64_t>, kBuckets> buckets_{};
};

class ScopedTimer {
public:
    explicit ScopedTimer(LatencyHistogram& sink) noexcept
        : sink_(sink), start_(std::chrono::steady_clock::now()) {}

    ScopedTimer(const ScopedTimer&) = delete;
    ScopedTimer& operator=(const ScopedTimer&) = delete;

    ~ScopedTimer() {
        sink_.record(std::chrono::steady_clock::now() - start_);
    }

private:
    LatencyHistogram& sink_;
    std::chrono::steady_clock::time_point start_;
};

}  // namespace vstream
