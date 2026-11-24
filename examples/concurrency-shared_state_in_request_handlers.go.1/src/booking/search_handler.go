package booking

import (
	"context"
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
	"sort"
	"strings"
	"sync"
	"time"
)

type Fare struct {
	ID       string `json:"id"`
	Carrier  string `json:"carrier"`
	Cents    int64  `json:"cents"`
	Currency string `json:"currency"`
	Stops    int    `json:"stops"`
}

type FareSource interface {
	Search(ctx context.Context, origin, dest string, depart time.Time) ([]Fare, error)
}

type cacheEntry struct {
	fares   []Fare
	fetched time.Time
}

type SearchHandler struct {
	fares    FareSource
	log      *slog.Logger
	cacheTTL time.Duration
	now      func() time.Time

	mu        sync.RWMutex
	cache     map[string]cacheEntry
	routeHits map[string]int
}

func NewSearchHandler(src FareSource, log *slog.Logger, ttl time.Duration) *SearchHandler {
	return &SearchHandler{
		fares:     src,
		log:       log,
		cacheTTL:  ttl,
		now:       time.Now,
		cache:     make(map[string]cacheEntry),
		routeHits: make(map[string]int),
	}
}

func (h *SearchHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	origin := strings.ToUpper(q.Get("from"))
	dest := strings.ToUpper(q.Get("to"))
	depart, err := time.Parse("2006-01-02", q.Get("date"))
	if err != nil || len(origin) != 3 || len(dest) != 3 {
		http.Error(w, "from, to and date (YYYY-MM-DD) are required", http.StatusBadRequest)
		return
	}
	sortBy := q.Get("sort")
	if sortBy == "" {
		sortBy = "price"
	}

	route := origin + "-" + dest
	h.recordHit(route)

	fares, err := h.lookup(r.Context(), route, origin, dest, depart)
	if err != nil {
		if errors.Is(err, context.Canceled) {
			return
		}
		h.log.Error("fare search failed", "route", route, "err", err)
		http.Error(w, "fare search unavailable", http.StatusBadGateway)
		return
	}

	out := append([]Fare(nil), fares...)
	switch sortBy {
	case "stops":
		sort.Slice(out, func(i, j int) bool { return out[i].Stops < out[j].Stops })
	default:
		sort.Slice(out, func(i, j int) bool { return out[i].Cents < out[j].Cents })
	}

	w.Header().Set("Content-Type", "application/json")
	if err := json.NewEncoder(w).Encode(map[string]any{"route": route, "fares": out}); err != nil {
		h.log.Warn("write response", "route", route, "err", err)
	}
}

func (h *SearchHandler) lookup(ctx context.Context, route, origin, dest string, depart time.Time) ([]Fare, error) {
	key := route + "@" + depart.Format("2006-01-02")

	h.mu.RLock()
	entry, ok := h.cache[key]
	h.mu.RUnlock()
	if ok && h.now().Sub(entry.fetched) < h.cacheTTL {
		return entry.fares, nil
	}

	fares, err := h.fares.Search(ctx, origin, dest, depart)
	if err != nil {
		return nil, err
	}

	h.mu.Lock()
	h.cache[key] = cacheEntry{fares: fares, fetched: h.now()}
	h.mu.Unlock()
	return fares, nil
}

func (h *SearchHandler) recordHit(route string) {
	h.mu.RLock()
	h.routeHits[route]++
	h.mu.RUnlock()
}

func (h *SearchHandler) PopularRoutes(limit int) []string {
	h.mu.RLock()
	defer h.mu.RUnlock()

	routes := make([]string, 0, len(h.routeHits))
	for route := range h.routeHits {
		routes = append(routes, route)
	}
	sort.Slice(routes, func(i, j int) bool { return h.routeHits[routes[i]] > h.routeHits[routes[j]] })
	if len(routes) > limit {
		routes = routes[:limit]
	}
	return routes
}
