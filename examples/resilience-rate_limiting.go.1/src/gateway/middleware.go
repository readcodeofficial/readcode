package gateway

import (
	"context"
	"net/http"
	"strings"

	"golang.org/x/time/rate"
)

type playerKey struct{}

func PlayerID(ctx context.Context) string {
	id, _ := ctx.Value(playerKey{}).(string)
	return id
}

// Authenticate resolves the bearer token to a player id using the session service.
func Authenticate(verify func(token string) (string, error)) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			token := strings.TrimPrefix(r.Header.Get("Authorization"), "Bearer ")
			playerID, err := verify(token)
			if err != nil || playerID == "" {
				http.Error(w, "invalid session", http.StatusUnauthorized)
				return
			}
			ctx := context.WithValue(r.Context(), playerKey{}, playerID)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

// RateLimit applies the per-player budget first, then the shared budget for
// the whole game server.
func RateLimit(perPlayer *PlayerLimiter, server *rate.Limiter) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			if !perPlayer.Allow(PlayerID(r.Context())) {
				w.Header().Set("Retry-After", "1")
				http.Error(w, "slow down", http.StatusTooManyRequests)
				return
			}
			if !server.Allow() {
				w.Header().Set("Retry-After", "2")
				http.Error(w, "server busy", http.StatusServiceUnavailable)
				return
			}
			next.ServeHTTP(w, r)
		})
	}
}
