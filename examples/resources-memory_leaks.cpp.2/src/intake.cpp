#include <chrono>
#include <memory>
#include <string>
#include <utility>
#include <vector>

#include "order_index.h"

namespace shop {

struct OrderRequest {
    std::string id;
    std::string customer;
    std::vector<OrderLine> lines;
};

enum class IntakeResult { Accepted, Duplicate, Invalid };

class OrderIntake {
public:
    explicit OrderIntake(OrderIndex& index) : index_(index) {}

    IntakeResult handle(const OrderRequest& request) {
        if (request.id.empty() || request.customer.empty() || request.lines.empty()) {
            return IntakeResult::Invalid;
        }
        for (const auto& line : request.lines) {
            if (line.quantity <= 0) {
                return IntakeResult::Invalid;
            }
        }

        auto order = std::make_unique<Order>();
        order->id = request.id;
        order->customer = request.customer;
        order->lines = request.lines;
        order->placedAt = std::chrono::system_clock::now();

        return index_.add(std::move(order)) ? IntakeResult::Accepted
                                            : IntakeResult::Duplicate;
    }

private:
    OrderIndex& index_;
};

}  // namespace shop
