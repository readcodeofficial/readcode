package dispatch

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"time"
)

type HTTPProvider struct {
	name   string
	url    string
	client *http.Client
}

func NewHTTPProvider(name, url string) *HTTPProvider {
	return &HTTPProvider{
		name:   name,
		url:    url,
		client: &http.Client{Timeout: 30 * time.Second},
	}
}

func (p *HTTPProvider) Name() string { return p.name }

type quoteRequest struct {
	JobID      string  `json:"job_id"`
	Restaurant string  `json:"restaurant_id"`
	Lat        float64 `json:"dropoff_lat"`
	Lng        float64 `json:"dropoff_lng"`
}

type quoteResponse struct {
	CourierID  string `json:"courier_id"`
	ETASeconds int    `json:"eta_seconds"`
}

func (p *HTTPProvider) Quote(ctx context.Context, job Job) (Quote, error) {
	if err := ctx.Err(); err != nil {
		return Quote{}, err
	}

	body, err := json.Marshal(quoteRequest{
		JobID: job.ID, Restaurant: job.RestaurantID, Lat: job.DropoffLat, Lng: job.DropoffLng,
	})
	if err != nil {
		return Quote{}, fmt.Errorf("encode request: %w", err)
	}

	req, err := http.NewRequest(http.MethodPost, p.url, bytes.NewReader(body))
	if err != nil {
		return Quote{}, fmt.Errorf("build request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := p.client.Do(req)
	if err != nil {
		return Quote{}, fmt.Errorf("call provider: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return Quote{}, fmt.Errorf("provider returned status %d", resp.StatusCode)
	}

	var qr quoteResponse
	if err := json.NewDecoder(resp.Body).Decode(&qr); err != nil {
		return Quote{}, fmt.Errorf("decode response: %w", err)
	}
	return Quote{
		Provider:  p.name,
		CourierID: qr.CourierID,
		ETA:       time.Duration(qr.ETASeconds) * time.Second,
	}, nil
}
