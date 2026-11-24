#pragma once

#include <cstdint>
#include <memory>
#include <mutex>
#include <shared_mutex>
#include <string>
#include <unordered_map>
#include <vector>

namespace iam {

struct Principal {
    explicit Principal(std::string principal_id, std::int64_t credits)
        : id(std::move(principal_id)), api_credits(credits) {}

    const std::string id;
    mutable std::mutex mu;
    std::vector<std::string> roles;
    std::int64_t api_credits;
};

class PrincipalDirectory {
public:
    std::shared_ptr<Principal> find(const std::string& id) const;
    std::shared_ptr<Principal> create(const std::string& id, std::int64_t credits);
    bool remove(const std::string& id);

    // Snapshot of the ids of every principal that currently holds `role`.
    std::vector<std::string> ids_with_role(const std::string& role) const;

private:
    mutable std::shared_mutex mu_;
    std::unordered_map<std::string, std::shared_ptr<Principal>> by_id_;
};

enum class TransferResult {
    Ok,
    UnknownPrincipal,
    SameAccount,
    InsufficientCredits,
    InvalidAmount,
};

TransferResult transfer_credits(PrincipalDirectory& dir,
                                const std::string& from_id,
                                const std::string& to_id,
                                std::int64_t amount);

bool grant_role(PrincipalDirectory& dir, const std::string& id, const std::string& role);

}  // namespace iam
