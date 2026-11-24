#pragma once

#include <chrono>
#include <cstddef>
#include <cstdint>
#include <memory>
#include <mutex>
#include <shared_mutex>
#include <string>
#include <unordered_map>
#include <utility>

#include "playlist_builder.h"
#include "scoped_timer.h"

namespace vstream {

class PlaylistService {
public:
    PlaylistService(PlaylistBuilder builder, std::size_t window, std::size_t max_entries)
        : builder_(std::move(builder)), window_(window), max_entries_(max_entries) {}

    std::shared_ptr<const std::string> get(std::uint32_t from_sequence) {
        const auto started = std::chrono::steady_clock::now();
        {
            std::shared_lock lock(mu_);
            auto it = cache_.find(from_sequence);
            if (it != cache_.end()) {
                hit_latency_.record(std::chrono::steady_clock::now() - started);
                return it->second;
            }
        }

        ScopedTimer t(render_latency_);
        auto rendered = std::make_shared<const std::string>(builder_.render(from_sequence, window_));

        std::unique_lock lock(mu_);
        if (cache_.size() >= max_entries_) {
            cache_.clear();
        }
        auto [it, inserted] = cache_.try_emplace(from_sequence, std::move(rendered));
        return it->second;
    }

    const LatencyHistogram& hit_latency() const { return hit_latency_; }
    const LatencyHistogram& render_latency() const { return render_latency_; }

private:
    PlaylistBuilder builder_;
    std::size_t window_;
    std::size_t max_entries_;

    std::shared_mutex mu_;
    std::unordered_map<std::uint32_t, std::shared_ptr<const std::string>> cache_;

    LatencyHistogram hit_latency_;
    LatencyHistogram render_latency_;
};

}  // namespace vstream
