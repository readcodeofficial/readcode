package feed

import (
	"context"
	"errors"
	"log/slog"
	"net/http"
	"time"
)

type Server struct {
	http   *http.Server
	health *Health
}

func NewServer(addr string, health *Health, feed http.Handler) *Server {
	mux := http.NewServeMux()
	health.Register(mux)
	mux.Handle("/v1/feed", feed)

	return &Server{
		health: health,
		http: &http.Server{
			Addr:              addr,
			Handler:           mux,
			ReadHeaderTimeout: 5 * time.Second,
		},
	}
}

func (s *Server) Run(ctx context.Context) error {
	errCh := make(chan error, 1)
	go func() {
		if err := s.http.ListenAndServe(); !errors.Is(err, http.ErrServerClosed) {
			errCh <- err
		}
		close(errCh)
	}()

	select {
	case err := <-errCh:
		return err
	case <-ctx.Done():
	}

	slog.Info("shutdown requested, draining")
	s.health.Drain()
	time.Sleep(5 * time.Second)

	shutdownCtx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
	defer cancel()
	return s.http.Shutdown(shutdownCtx)
}
