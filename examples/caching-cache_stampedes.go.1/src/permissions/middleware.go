package permissions

import (
	"errors"
	"log/slog"
	"net/http"
	"time"
)

func RequireGrant(r *CachedResolver, resource, action string, next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		userID := req.Header.Get("X-User-ID")
		if userID == "" {
			http.Error(w, "unauthenticated", http.StatusUnauthorized)
			return
		}

		start := time.Now()
		set, err := r.Resolve(req.Context(), userID)
		switch {
		case errors.Is(err, ErrUserNotFound):
			http.Error(w, "forbidden", http.StatusForbidden)
			return
		case err != nil:
			slog.Error("resolve permissions", "user", userID, "err", err, "took", time.Since(start))
			http.Error(w, "authorization unavailable", http.StatusServiceUnavailable)
			return
		}

		for _, g := range set.Grants {
			if g.Resource == resource && g.Action == action {
				next.ServeHTTP(w, req)
				return
			}
		}
		http.Error(w, "forbidden", http.StatusForbidden)
	})
}
