#include "order_index.h"

#include <algorithm>

namespace shop {

OrderIndex::~OrderIndex() {
    for (auto& entry : byId_) {
        delete entry.second;
    }
}

bool OrderIndex::add(std::unique_ptr<Order> order) {
    Order* raw = order.release();
    std::lock_guard<std::mutex> lock(mu_);
    if (!byId_.emplace(raw->id, raw).second) {
        return false;
    }
    byCustomer_[raw->customer].push_back(raw);
    return true;
}

std::unique_ptr<Order> OrderIndex::remove(const std::string& id) {
    std::lock_guard<std::mutex> lock(mu_);
    auto it = byId_.find(id);
    if (it == byId_.end()) {
        return nullptr;
    }
    std::unique_ptr<Order> owned(it->second);
    byId_.erase(it);

    auto& list = byCustomer_[owned->customer];
    list.erase(std::remove(list.begin(), list.end(), owned.get()), list.end());
    if (list.empty()) {
        byCustomer_.erase(owned->customer);
    }
    return owned;
}

std::vector<Order> OrderIndex::forCustomer(const std::string& customer) const {
    std::lock_guard<std::mutex> lock(mu_);
    std::vector<Order> copies;
    auto it = byCustomer_.find(customer);
    if (it != byCustomer_.end()) {
        for (const Order* order : it->second) {
            copies.push_back(*order);
        }
    }
    return copies;
}

std::size_t OrderIndex::purgeOlderThan(std::chrono::system_clock::time_point cutoff) {
    std::vector<std::string> stale;
    {
        std::lock_guard<std::mutex> lock(mu_);
        for (const auto& entry : byId_) {
            if (entry.second->placedAt < cutoff) {
                stale.push_back(entry.first);
            }
        }
    }
    std::size_t purged = 0;
    for (const auto& id : stale) {
        if (remove(id)) {
            ++purged;
        }
    }
    return purged;
}

std::size_t OrderIndex::size() const {
    std::lock_guard<std::mutex> lock(mu_);
    return byId_.size();
}

}  // namespace shop
