package sessions;

import java.util.Optional;

public final class SessionService {
    private final QuorumStore store;

    public SessionService(QuorumStore store) {
        this.store = store;
    }

    public boolean login(String userId, String token) {
        return store.put("session:" + userId, token);
    }

    public boolean logout(String userId) {
        return store.put("session:" + userId, "");
    }

    public boolean isLoggedIn(String userId, String token) {
        Optional<String> stored = store.get("session:" + userId);
        return stored.isPresent() && !stored.get().isEmpty() && stored.get().equals(token);
    }
}
