#pragma once

#include <chrono>
#include <cstddef>
#include <memory>
#include <mutex>
#include <string>
#include <unordered_map>
#include <vector>

namespace shop {

struct OrderLine {
    std::string sku;
    int quantity = 0;
};

struct Order {
    std::string id;
    std::string customer;
    std::vector<OrderLine> lines;
    std::chrono::system_clock::time_point placedAt;
};

// Thread-safe in-memory index of open orders, looked up by id and by customer.
class OrderIndex {
public:
    OrderIndex() = default;
    OrderIndex(const OrderIndex&) = delete;
    OrderIndex& operator=(const OrderIndex&) = delete;
    ~OrderIndex();

    bool add(std::unique_ptr<Order> order);
    std::unique_ptr<Order> remove(const std::string& id);
    std::vector<Order> forCustomer(const std::string& customer) const;
    std::size_t purgeOlderThan(std::chrono::system_clock::time_point cutoff);
    std::size_t size() const;

private:
    mutable std::mutex mu_;
    std::unordered_map<std::string, Order*> byId_;
    std::unordered_map<std::string, std::vector<Order*>> byCustomer_;
};

}  // namespace shop
