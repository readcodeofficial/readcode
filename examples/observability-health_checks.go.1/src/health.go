package feed

import (
	"context"
	"database/sql"
	"encoding/json"
	"net/http"
	"sync"
	"time"
)

const checkTimeout = 800 * time.Millisecond

type Pinger interface {
	PingContext(ctx context.Context) error
}

type Health struct {
	db        *sql.DB
	cache     Pinger
	startedAt time.Time

	mu       sync.RWMutex
	draining bool
}

func NewHealth(db *sql.DB, cache Pinger) *Health {
	return &Health{db: db, cache: cache, startedAt: time.Now()}
}

func (h *Health) Drain() {
	h.mu.Lock()
	h.draining = true
	h.mu.Unlock()
}

func (h *Health) isDraining() bool {
	h.mu.RLock()
	defer h.mu.RUnlock()
	return h.draining
}

type checkResult struct {
	Name   string `json:"name"`
	OK     bool   `json:"ok"`
	Detail string `json:"detail,omitempty"`
}

func (h *Health) run(ctx context.Context) []checkResult {
	checks := []struct {
		name string
		p    Pinger
	}{
		{"postgres", h.db},
		{"redis", h.cache},
	}

	results := make([]checkResult, len(checks))
	var wg sync.WaitGroup
	for i, c := range checks {
		wg.Add(1)
		go func(i int, name string, p Pinger) {
			defer wg.Done()
			cctx, cancel := context.WithTimeout(ctx, checkTimeout)
			defer cancel()
			if err := p.PingContext(cctx); err != nil {
				results[i] = checkResult{Name: name, OK: false, Detail: err.Error()}
				return
			}
			results[i] = checkResult{Name: name, OK: true}
		}(i, c.name, c.p)
	}
	wg.Wait()
	return results
}

func (h *Health) live(w http.ResponseWriter, _ *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(map[string]any{
		"status": "alive",
		"uptime": time.Since(h.startedAt).Round(time.Second).String(),
	})
}

func (h *Health) ready(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")
	if h.isDraining() {
		w.WriteHeader(http.StatusServiceUnavailable)
		_ = json.NewEncoder(w).Encode(map[string]string{"status": "draining"})
		return
	}

	results := h.run(r.Context())
	status := http.StatusOK
	for _, res := range results {
		if !res.OK {
			status = http.StatusServiceUnavailable
		}
	}
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(map[string]any{"checks": results})
}

func (h *Health) Register(mux *http.ServeMux) {
	mux.HandleFunc("/healthz", h.ready)
	mux.HandleFunc("/livez", h.live)
	mux.HandleFunc("/readyz", h.ready)
}
