#include "shard_ring.h"

#include <functional>
#include <set>
#include <stdexcept>

namespace orders {

uint64_t ShardRing::point_for(const std::string& s) {
    return std::hash<std::string>{}(s);
}

void ShardRing::add_node(const std::string& node) {
    std::unique_lock lock(mu_);
    if (nodes_.count(node) > 0) {
        return;
    }
    nodes_[node] = virtual_nodes_;
    for (int i = 0; i < virtual_nodes_; ++i) {
        ring_.emplace(point_for(node + "#" + std::to_string(i)), node);
    }
}

void ShardRing::remove_node(const std::string& node) {
    std::unique_lock lock(mu_);
    if (nodes_.erase(node) == 0) {
        return;
    }
    for (auto it = ring_.begin(); it != ring_.end();) {
        if (it->second == node) {
            it = ring_.erase(it);
        } else {
            ++it;
        }
    }
}

std::string ShardRing::owner(const std::string& key) const {
    std::shared_lock lock(mu_);
    if (ring_.empty()) {
        throw std::runtime_error("shard ring has no nodes");
    }
    auto it = ring_.lower_bound(point_for(key));
    if (it == ring_.end()) {
        it = ring_.begin();
    }
    return it->second;
}

std::vector<std::string> ShardRing::replicas(const std::string& key, size_t count) const {
    std::shared_lock lock(mu_);
    std::vector<std::string> out;
    if (ring_.empty()) {
        return out;
    }
    std::set<std::string> seen;
    auto it = ring_.lower_bound(point_for(key));
    for (size_t steps = 0; steps < ring_.size() && out.size() < count; ++steps) {
        if (it == ring_.end()) {
            it = ring_.begin();
        }
        if (seen.insert(it->second).second) {
            out.push_back(it->second);
        }
        ++it;
    }
    return out;
}

size_t ShardRing::node_count() const {
    std::shared_lock lock(mu_);
    return nodes_.size();
}

}  // namespace orders
