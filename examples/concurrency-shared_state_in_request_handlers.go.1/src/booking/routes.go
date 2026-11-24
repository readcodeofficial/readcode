package booking

import (
	"log/slog"
	"net/http"
	"strconv"
	"time"
)

func Routes(src FareSource, log *slog.Logger) http.Handler {
	search := NewSearchHandler(src, log, 90*time.Second)

	mux := http.NewServeMux()
	mux.Handle("/v1/fares", search)
	mux.HandleFunc("/v1/fares/popular", func(w http.ResponseWriter, r *http.Request) {
		limit, err := strconv.Atoi(r.URL.Query().Get("limit"))
		if err != nil || limit < 1 || limit > 50 {
			limit = 10
		}
		for _, route := range search.PopularRoutes(limit) {
			if _, err := w.Write([]byte(route + "\n")); err != nil {
				return
			}
		}
	})
	return mux
}
