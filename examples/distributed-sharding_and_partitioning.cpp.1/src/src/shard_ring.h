#pragma once

#include <cstdint>
#include <map>
#include <mutex>
#include <shared_mutex>
#include <string>
#include <vector>

namespace orders {

class ShardRing {
public:
    explicit ShardRing(int virtual_nodes = 128) : virtual_nodes_(virtual_nodes) {}

    void add_node(const std::string& node);
    void remove_node(const std::string& node);

    // Primary owner of the key.
    std::string owner(const std::string& key) const;

    // Owner followed by the next distinct nodes clockwise, up to `count` nodes.
    std::vector<std::string> replicas(const std::string& key, size_t count) const;

    size_t node_count() const;

private:
    static uint64_t point_for(const std::string& s);

    int virtual_nodes_;
    mutable std::shared_mutex mu_;
    std::map<uint64_t, std::string> ring_;
    std::map<std::string, int> nodes_;
};

}  // namespace orders
