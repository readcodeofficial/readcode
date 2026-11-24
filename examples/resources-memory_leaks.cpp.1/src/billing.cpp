#include "billing.h"

#include <algorithm>

namespace billing {

const std::string& Subscription::accountId() const { return account_->id(); }

std::shared_ptr<Subscription> Account::addSubscription(const std::string& plan,
                                                       std::int64_t priceCents) {
    std::lock_guard<std::mutex> lock(mutex_);
    auto sub = std::make_shared<Subscription>(
        id_ + "-sub-" + std::to_string(nextSubscription_++), shared_from_this(), plan, priceCents);
    subs_.push_back(sub);
    return sub;
}

bool Account::removeSubscription(const std::string& subscriptionId) {
    std::lock_guard<std::mutex> lock(mutex_);
    auto it = std::find_if(subs_.begin(), subs_.end(),
                           [&](const auto& s) { return s->id() == subscriptionId; });
    if (it == subs_.end()) return false;
    (*it)->cancel();
    subs_.erase(it);
    return true;
}

std::vector<std::shared_ptr<Subscription>> Account::subscriptions() const {
    std::lock_guard<std::mutex> lock(mutex_);
    return subs_;
}

std::int64_t Account::monthlyTotalCents() const {
    std::lock_guard<std::mutex> lock(mutex_);
    std::int64_t total = 0;
    for (const auto& sub : subs_) {
        if (sub->active()) total += sub->priceCents();
    }
    return total;
}

void Account::cancelAll() {
    std::lock_guard<std::mutex> lock(mutex_);
    for (const auto& sub : subs_) sub->cancel();
}

std::shared_ptr<Account> AccountRegistry::open(const std::string& id, const std::string& email) {
    std::lock_guard<std::mutex> lock(mutex_);
    auto [it, inserted] = accounts_.try_emplace(id, nullptr);
    if (inserted) it->second = std::make_shared<Account>(id, email);
    return it->second;
}

std::shared_ptr<Account> AccountRegistry::find(const std::string& id) const {
    std::lock_guard<std::mutex> lock(mutex_);
    auto it = accounts_.find(id);
    return it == accounts_.end() ? nullptr : it->second;
}

bool AccountRegistry::close(const std::string& id) {
    std::shared_ptr<Account> account;
    {
        std::lock_guard<std::mutex> lock(mutex_);
        auto it = accounts_.find(id);
        if (it == accounts_.end()) return false;
        account = std::move(it->second);
        accounts_.erase(it);
    }
    account->cancelAll();
    return true;
}

std::vector<std::shared_ptr<Account>> AccountRegistry::snapshot() const {
    std::lock_guard<std::mutex> lock(mutex_);
    std::vector<std::shared_ptr<Account>> out;
    out.reserve(accounts_.size());
    for (const auto& [id, account] : accounts_) out.push_back(account);
    return out;
}

BillingSummary runBilling(const AccountRegistry& registry, PaymentGateway& gateway,
                          const std::string& period) {
    BillingSummary summary;
    for (const auto& account : registry.snapshot()) {
        const std::int64_t total = account->monthlyTotalCents();
        if (total == 0) {
            ++summary.skipped;
            continue;
        }
        try {
            gateway.charge(account->id(), total, account->id() + ":" + period);
            ++summary.charged;
        } catch (const PaymentError&) {
            summary.failedAccounts.push_back(account->id());
        }
    }
    return summary;
}

}  // namespace billing
