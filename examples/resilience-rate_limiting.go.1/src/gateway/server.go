package gateway

import (
	"context"
	"encoding/json"
	"net/http"
	"time"

	"golang.org/x/time/rate"
)

type Room interface {
	Broadcast(playerID, text string) error
}

type chatRequest struct {
	RoomID string `json:"room_id"`
	Text   string `json:"text"`
}

func ChatHandler(rooms func(id string) (Room, bool)) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		var req chatRequest
		if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 4096)).Decode(&req); err != nil {
			http.Error(w, "bad request", http.StatusBadRequest)
			return
		}
		room, ok := rooms(req.RoomID)
		if !ok {
			http.Error(w, "unknown room", http.StatusNotFound)
			return
		}
		if err := room.Broadcast(PlayerID(r.Context()), req.Text); err != nil {
			http.Error(w, "broadcast failed", http.StatusInternalServerError)
			return
		}
		w.WriteHeader(http.StatusAccepted)
	}
}

func NewServer(ctx context.Context, verify func(string) (string, error), rooms func(string) (Room, bool)) *http.Server {
	perPlayer := NewPlayerLimiter(rate.Every(500*time.Millisecond), 5, 10*time.Minute)
	go perPlayer.RunSweeper(ctx, time.Minute)

	serverBudget := rate.NewLimiter(2000, 4000)

	mux := http.NewServeMux()
	mux.Handle("/v1/chat", ChatHandler(rooms))

	handler := Authenticate(verify)(RateLimit(perPlayer, serverBudget)(mux))
	return &http.Server{
		Addr:              ":8080",
		Handler:           handler,
		ReadHeaderTimeout: 5 * time.Second,
	}
}
