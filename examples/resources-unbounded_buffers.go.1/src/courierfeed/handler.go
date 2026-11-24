package courierfeed

import (
	"encoding/json"
	"io"
	"net/http"
	"strconv"
)

const (
	maxSingleBody = 4 << 10
	maxBulkEvents = 500
)

type Handler struct {
	batcher *Batcher
}

func NewHandler(b *Batcher) http.Handler {
	h := &Handler{batcher: b}
	mux := http.NewServeMux()
	mux.HandleFunc("POST /v1/location", h.single)
	mux.HandleFunc("POST /v1/location/bulk", h.bulk)
	return mux
}

func (h *Handler) single(w http.ResponseWriter, r *http.Request) {
	dec := json.NewDecoder(http.MaxBytesReader(w, r.Body, maxSingleBody))
	dec.DisallowUnknownFields()
	var ev Event
	if err := dec.Decode(&ev); err != nil {
		http.Error(w, "invalid event", http.StatusBadRequest)
		return
	}
	h.enqueue(w, []Event{ev})
}

func (h *Handler) bulk(w http.ResponseWriter, r *http.Request) {
	raw, err := io.ReadAll(r.Body)
	if err != nil {
		http.Error(w, "unreadable body", http.StatusBadRequest)
		return
	}
	var events []Event
	if err := json.Unmarshal(raw, &events); err != nil {
		http.Error(w, "invalid events", http.StatusBadRequest)
		return
	}
	if len(events) == 0 || len(events) > maxBulkEvents {
		http.Error(w, "bulk size must be 1-"+strconv.Itoa(maxBulkEvents), http.StatusRequestEntityTooLarge)
		return
	}
	h.enqueue(w, events)
}

func (h *Handler) enqueue(w http.ResponseWriter, events []Event) {
	for i, ev := range events {
		if !h.batcher.Offer(ev) {
			w.Header().Set("Retry-After", "2")
			http.Error(w, "intake queue full, accepted "+strconv.Itoa(i), http.StatusServiceUnavailable)
			return
		}
	}
	w.WriteHeader(http.StatusAccepted)
}
