#include "authz.h"

#include <exception>
#include <memory>
#include <string>
#include <thread>

#include "policy_engine.hpp"

struct authz_handle {
    explicit authz_handle(std::string p) : path(std::move(p)) {}
    std::string path;
    authz::PolicyEngine engine;
    std::thread reloader;
};

namespace {

thread_local std::string g_last_error;

void record_error(const char* what) {
    g_last_error = what;
}

template <typename F>
int guarded(F&& body) noexcept {
    try {
        return body();
    } catch (const std::exception& e) {
        record_error(e.what());
    } catch (...) {
        record_error("unknown internal error");
    }
    return AUTHZ_ERROR;
}

}  // namespace

extern "C" {

authz_handle* authz_open(const char* policy_path) {
    if (policy_path == nullptr) {
        record_error("policy_path is null");
        return nullptr;
    }
    try {
        auto h = std::make_unique<authz_handle>(policy_path);
        h->engine.reload(h->path);
        return h.release();
    } catch (const std::exception& e) {
        record_error(e.what());
    } catch (...) {
        record_error("unknown internal error");
    }
    return nullptr;
}

int authz_check(authz_handle* h, const char* role, const char* action, const char* resource) {
    if (h == nullptr || role == nullptr || action == nullptr || resource == nullptr) {
        record_error("null argument");
        return AUTHZ_ERROR;
    }
    return guarded([&] {
        auto decision = h->engine.check(role, action, resource);
        return decision == authz::Decision::Allow ? AUTHZ_ALLOW : AUTHZ_DENY;
    });
}

int authz_reload_async(authz_handle* h, authz_reload_cb cb, void* ctx) {
    if (h == nullptr || cb == nullptr) {
        record_error("null argument");
        return AUTHZ_ERROR;
    }
    return guarded([&] {
        if (h->reloader.joinable()) {
            h->reloader.join();
        }
        h->reloader = std::thread([h, cb, ctx] {
            h->engine.reload(h->path);
            cb(ctx, AUTHZ_ALLOW);
        });
        return AUTHZ_ALLOW;
    });
}

const char* authz_last_error(void) {
    return g_last_error.c_str();
}

void authz_close(authz_handle* h) {
    if (h != nullptr && h->reloader.joinable()) {
        h->reloader.join();
    }
    delete h;
}

}  // extern "C"
