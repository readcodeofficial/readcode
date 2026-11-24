#pragma once

#include <atomic>
#include <cstdint>
#include <memory>
#include <mutex>
#include <stdexcept>
#include <string>
#include <unordered_map>
#include <vector>

namespace billing {

class Account;

class Subscription {
public:
    Subscription(std::string id, std::shared_ptr<Account> account, std::string plan,
                 std::int64_t priceCents)
        : id_(std::move(id)), account_(std::move(account)), plan_(std::move(plan)),
          priceCents_(priceCents) {}

    const std::string& id() const { return id_; }
    const std::string& plan() const { return plan_; }
    std::int64_t priceCents() const { return priceCents_; }
    bool active() const { return active_.load(); }
    void cancel() { active_.store(false); }
    const std::string& accountId() const;

private:
    std::string id_;
    std::shared_ptr<Account> account_;
    std::string plan_;
    std::int64_t priceCents_;
    std::atomic<bool> active_{true};
};

class Account : public std::enable_shared_from_this<Account> {
public:
    Account(std::string id, std::string email) : id_(std::move(id)), email_(std::move(email)) {}

    const std::string& id() const { return id_; }
    const std::string& email() const { return email_; }

    std::shared_ptr<Subscription> addSubscription(const std::string& plan, std::int64_t priceCents);
    bool removeSubscription(const std::string& subscriptionId);
    std::vector<std::shared_ptr<Subscription>> subscriptions() const;
    std::int64_t monthlyTotalCents() const;
    void cancelAll();

private:
    std::string id_;
    std::string email_;
    mutable std::mutex mutex_;
    std::vector<std::shared_ptr<Subscription>> subs_;
    int nextSubscription_ = 1;
};

class AccountRegistry {
public:
    std::shared_ptr<Account> open(const std::string& id, const std::string& email);
    std::shared_ptr<Account> find(const std::string& id) const;
    bool close(const std::string& id);
    std::vector<std::shared_ptr<Account>> snapshot() const;

private:
    mutable std::mutex mutex_;
    std::unordered_map<std::string, std::shared_ptr<Account>> accounts_;
};

struct PaymentError : std::runtime_error {
    using std::runtime_error::runtime_error;
};

class PaymentGateway {
public:
    virtual ~PaymentGateway() = default;
    virtual void charge(const std::string& accountId, std::int64_t amountCents,
                        const std::string& idempotencyKey) = 0;
};

struct BillingSummary {
    int charged = 0;
    int skipped = 0;
    std::vector<std::string> failedAccounts;
};

BillingSummary runBilling(const AccountRegistry& registry, PaymentGateway& gateway,
                          const std::string& period);

}  // namespace billing
