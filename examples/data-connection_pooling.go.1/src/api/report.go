package api

import (
	"context"
	"encoding/json"
	"errors"
	"net/http"
	"strconv"
	"time"

	"adsreport/store"
)

type ReportHandler struct {
	Stats *store.StatsStore
}

func parseAdvertiserIDs(raw []string) ([]int64, error) {
	ids := make([]int64, 0, len(raw))
	for _, s := range raw {
		id, err := strconv.ParseInt(s, 10, 64)
		if err != nil || id <= 0 {
			return nil, errors.New("invalid advertiser id")
		}
		ids = append(ids, id)
	}
	return ids, nil
}

func (h *ReportHandler) Daily(w http.ResponseWriter, r *http.Request) {
	ctx, cancel := context.WithTimeout(r.Context(), 2*time.Second)
	defer cancel()

	ids, err := parseAdvertiserIDs(r.URL.Query()["advertiser"])
	if err != nil {
		http.Error(w, err.Error(), http.StatusBadRequest)
		return
	}
	day := time.Now().UTC().Truncate(24 * time.Hour)

	res, err := h.Stats.ForAdvertisers(ctx, ids, day)
	switch {
	case errors.Is(err, context.DeadlineExceeded):
		http.Error(w, "report timed out", http.StatusGatewayTimeout)
		return
	case err != nil:
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "application/json")
	_ = json.NewEncoder(w).Encode(res)
}
