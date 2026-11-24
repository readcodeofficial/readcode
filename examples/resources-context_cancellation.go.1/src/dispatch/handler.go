package dispatch

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
)

type CandidateFinder interface {
	Nearby(ctx context.Context, trip Trip, limit int) ([]Driver, error)
}

type Handler struct {
	finder     CandidateFinder
	dispatcher *Dispatcher
}

func NewHandler(f CandidateFinder, d *Dispatcher) *Handler {
	return &Handler{finder: f, dispatcher: d}
}

func (h *Handler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	var trip Trip
	if err := json.NewDecoder(r.Body).Decode(&trip); err != nil {
		http.Error(w, "invalid trip", http.StatusBadRequest)
		return
	}

	candidates, err := h.finder.Nearby(r.Context(), trip, 12)
	if err != nil {
		h.fail(w, r, err)
		return
	}

	driver, err := h.dispatcher.Assign(r.Context(), trip, candidates)
	if err != nil {
		h.fail(w, r, err)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]string{"trip": trip.ID, "driver": driver.ID})
}

func (h *Handler) fail(w http.ResponseWriter, r *http.Request, err error) {
	switch {
	case errors.Is(err, context.Canceled) && r.Context().Err() != nil:
		return
	case errors.Is(err, context.DeadlineExceeded), errors.Is(err, ErrNoDriver):
		http.Error(w, "no driver available", http.StatusServiceUnavailable)
	default:
		http.Error(w, "dispatch failed", http.StatusInternalServerError)
	}
}
