#include "shard_ring.h"

#include <map>
#include <string>
#include <vector>

namespace orders {

struct StockUpdate {
    std::string sku;
    std::string warehouse_id;
    int delta;
};

class InventoryRouter {
public:
    InventoryRouter(ShardRing& ring, size_t replication_factor)
        : ring_(ring), replication_factor_(replication_factor) {}

    // Inventory is partitioned by warehouse so that all SKUs of one
    // warehouse live on the same shard and can be updated in one transaction.
    std::string shard_for(const StockUpdate& u) const {
        return ring_.owner("wh:" + u.warehouse_id);
    }

    std::map<std::string, std::vector<StockUpdate>> group_by_shard(
        const std::vector<StockUpdate>& updates) const {
        std::map<std::string, std::vector<StockUpdate>> groups;
        for (const auto& u : updates) {
            groups[shard_for(u)].push_back(u);
        }
        return groups;
    }

    // Order records are partitioned by customer to keep a customer's order
    // history on one shard; the extra replicas serve reads when it is down.
    std::vector<std::string> order_read_targets(const std::string& customer_id) const {
        return ring_.replicas("cust:" + customer_id, replication_factor_);
    }

    std::string order_write_target(const std::string& customer_id) const {
        return ring_.owner("cust:" + customer_id);
    }

private:
    ShardRing& ring_;
    size_t replication_factor_;
};

}  // namespace orders
