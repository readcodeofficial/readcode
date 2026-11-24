package main

import (
	"context"
	"errors"
	"net/http"
	"time"

	"example.com/ci/runner"
)

type server struct {
	pool *runner.Pool
	exec func(ctx context.Context, repo, ref string) error
}

func (s *server) handleTrigger(w http.ResponseWriter, r *http.Request) {
	repo, ref := r.FormValue("repo"), r.FormValue("ref")
	job := runner.Job{
		ID:   repo + "@" + ref,
		Repo: repo,
		Run: func(ctx context.Context) error {
			return s.exec(ctx, repo, ref)
		},
	}
	err := s.pool.Submit(r.Context(), job)
	switch {
	case errors.Is(err, runner.ErrAtCapacity):
		w.Header().Set("Retry-After", "5")
		http.Error(w, "runner busy", http.StatusServiceUnavailable)
	case err != nil:
		http.Error(w, "internal error", http.StatusInternalServerError)
	default:
		w.WriteHeader(http.StatusAccepted)
	}
}

func (s *server) handleReload(w http.ResponseWriter, r *http.Request) {
	s.pool.SetLimits(runner.Limits{MaxConcurrent: 8, JobTimeout: 20 * time.Minute})
	w.WriteHeader(http.StatusNoContent)
}
