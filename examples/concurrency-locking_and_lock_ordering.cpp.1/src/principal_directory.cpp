#include "principal_directory.h"

#include <algorithm>
#include <mutex>

namespace iam {

std::shared_ptr<Principal> PrincipalDirectory::find(const std::string& id) const {
    std::shared_lock lock(mu_);
    auto it = by_id_.find(id);
    return it == by_id_.end() ? nullptr : it->second;
}

std::shared_ptr<Principal> PrincipalDirectory::create(const std::string& id, std::int64_t credits) {
    std::unique_lock lock(mu_);
    auto [it, inserted] = by_id_.try_emplace(id, nullptr);
    if (inserted) {
        it->second = std::make_shared<Principal>(id, credits);
    }
    return it->second;
}

bool PrincipalDirectory::remove(const std::string& id) {
    std::unique_lock lock(mu_);
    return by_id_.erase(id) > 0;
}

std::vector<std::string> PrincipalDirectory::ids_with_role(const std::string& role) const {
    std::vector<std::string> out;
    std::shared_lock dir_lock(mu_);
    for (const auto& [id, principal] : by_id_) {
        std::lock_guard<std::mutex> lock(principal->mu);
        if (std::find(principal->roles.begin(), principal->roles.end(), role) !=
            principal->roles.end()) {
            out.push_back(id);
        }
    }
    return out;
}

TransferResult transfer_credits(PrincipalDirectory& dir,
                                const std::string& from_id,
                                const std::string& to_id,
                                std::int64_t amount) {
    if (amount <= 0) {
        return TransferResult::InvalidAmount;
    }
    if (from_id == to_id) {
        return TransferResult::SameAccount;
    }

    auto from = dir.find(from_id);
    auto to = dir.find(to_id);
    if (!from || !to) {
        return TransferResult::UnknownPrincipal;
    }

    std::scoped_lock lock(from->mu, to->mu);
    if (from->api_credits < amount) {
        return TransferResult::InsufficientCredits;
    }
    from->api_credits -= amount;
    to->api_credits += amount;
    return TransferResult::Ok;
}

bool grant_role(PrincipalDirectory& dir, const std::string& id, const std::string& role) {
    auto principal = dir.find(id);
    if (!principal) {
        return false;
    }
    std::lock_guard<std::mutex> lock(principal->mu);
    if (std::find(principal->roles.begin(), principal->roles.end(), role) ==
        principal->roles.end()) {
        principal->roles.push_back(role);
    }
    return true;
}

}  // namespace iam
