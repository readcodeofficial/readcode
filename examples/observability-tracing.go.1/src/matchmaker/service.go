package matchmaker

import (
	"context"
	"encoding/json"
	"net/http"

	"go.opentelemetry.io/contrib/instrumentation/net/http/otelhttp"
	"go.opentelemetry.io/otel"
	"go.opentelemetry.io/otel/attribute"
	"go.opentelemetry.io/otel/codes"
	"go.opentelemetry.io/otel/trace"
	"golang.org/x/sync/errgroup"
)

var tracer = otel.Tracer("game/matchmaker")

type Candidate struct {
	Profile Profile
	Rating  Rating
}

type Service struct {
	profiles *ProfileClient
	ratings  *RatingClient
}

func NewService(p *ProfileClient, r *RatingClient) *Service {
	return &Service{profiles: p, ratings: r}
}

func (s *Service) loadCandidate(ctx context.Context, playerID string) (Candidate, error) {
	ctx, span := tracer.Start(ctx, "matchmaker.loadCandidate",
		trace.WithAttributes(attribute.String("player.id", playerID)))
	defer span.End()

	var c Candidate
	g, gctx := errgroup.WithContext(ctx)
	g.Go(func() (err error) {
		c.Profile, err = s.profiles.Get(gctx, playerID)
		return err
	})
	g.Go(func() (err error) {
		c.Rating, err = s.ratings.Get(gctx, playerID)
		return err
	})
	if err := g.Wait(); err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, "load candidate failed")
		return Candidate{}, err
	}
	span.SetAttributes(attribute.String("player.region", c.Profile.Region))
	return c, nil
}

func (s *Service) Enqueue(ctx context.Context, playerID, mode string) (Candidate, error) {
	ctx, span := tracer.Start(ctx, "matchmaker.enqueue",
		trace.WithAttributes(attribute.String("game.mode", mode)))
	defer span.End()

	cand, err := s.loadCandidate(ctx, playerID)
	if err != nil {
		span.RecordError(err)
		span.SetStatus(codes.Error, "enqueue failed")
		return Candidate{}, err
	}
	span.SetAttributes(attribute.Float64("player.mu", cand.Rating.Mu))
	return cand, nil
}

func (s *Service) Handler() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("POST /v1/queue/{mode}", func(w http.ResponseWriter, r *http.Request) {
		playerID := r.Header.Get("X-Player-ID")
		cand, err := s.Enqueue(r.Context(), playerID, r.PathValue("mode"))
		if err != nil {
			http.Error(w, "matchmaking unavailable", http.StatusBadGateway)
			return
		}
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(cand)
	})
	return otelhttp.NewHandler(mux, "matchmaker")
}
