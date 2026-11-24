package indexer

import (
	"crypto/rand"
	"encoding/hex"
	"log/slog"
	"net/http"
	"time"

	"searchsvc/logging"
)

type statusRecorder struct {
	http.ResponseWriter
	status int
}

func (s *statusRecorder) WriteHeader(code int) {
	s.status = code
	s.ResponseWriter.WriteHeader(code)
}

func WithRequestLog(base *slog.Logger, next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		id := r.Header.Get("X-Request-ID")
		if id == "" {
			buf := make([]byte, 8)
			_, _ = rand.Read(buf)
			id = hex.EncodeToString(buf)
		}
		l := base.With("request_id", id, "method", r.Method, "path", r.URL.Path)
		ctx := logging.WithLogger(r.Context(), l)

		rec := &statusRecorder{ResponseWriter: w, status: http.StatusOK}
		start := time.Now()
		next.ServeHTTP(rec, r.WithContext(ctx))

		level := slog.LevelInfo
		if rec.status >= 500 {
			level = slog.LevelError
		}
		l.Log(ctx, level, "request completed",
			slog.Int("status", rec.status),
			slog.Duration("elapsed", time.Since(start)))
	})
}
