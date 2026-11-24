#pragma once

#include <fstream>
#include <mutex>
#include <shared_mutex>
#include <stdexcept>
#include <string>
#include <vector>

#include <nlohmann/json.hpp>

namespace authz {

struct Rule {
    std::string role;
    std::string action;
    std::string resource;
    bool allow;
};

enum class Decision { Allow, Deny };

class PolicyError : public std::runtime_error {
public:
    using std::runtime_error::runtime_error;
};

class PolicyEngine {
public:
    void reload(const std::string& path) {
        std::ifstream in(path);
        if (!in) {
            throw PolicyError("cannot open policy file: " + path);
        }
        nlohmann::json doc = nlohmann::json::parse(in);

        std::vector<Rule> next;
        for (const auto& r : doc.at("rules")) {
            next.push_back(Rule{r.at("role").get<std::string>(),
                                r.at("action").get<std::string>(),
                                r.at("resource").get<std::string>(),
                                r.at("effect").get<std::string>() == "allow"});
        }
        if (next.empty()) {
            throw PolicyError("policy file contains no rules: " + path);
        }

        std::unique_lock lock(mu_);
        rules_.swap(next);
    }

    Decision check(const std::string& role, const std::string& action,
                   const std::string& resource) const {
        std::shared_lock lock(mu_);
        bool allowed = false;
        for (const auto& rule : rules_) {
            if (!matches(rule.role, role) || !matches(rule.action, action) ||
                !matches(rule.resource, resource)) {
                continue;
            }
            if (!rule.allow) {
                return Decision::Deny;
            }
            allowed = true;
        }
        return allowed ? Decision::Allow : Decision::Deny;
    }

private:
    static bool matches(const std::string& pattern, const std::string& value) {
        return pattern == "*" || pattern == value;
    }

    mutable std::shared_mutex mu_;
    std::vector<Rule> rules_;
};

}  // namespace authz
