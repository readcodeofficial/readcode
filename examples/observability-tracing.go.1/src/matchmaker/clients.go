package matchmaker

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"time"

	"go.opentelemetry.io/contrib/instrumentation/net/http/otelhttp"
)

type Profile struct {
	PlayerID string `json:"player_id"`
	Region   string `json:"region"`
}

type Rating struct {
	PlayerID string  `json:"player_id"`
	Mu       float64 `json:"mu"`
	Sigma    float64 `json:"sigma"`
}

type ProfileClient struct {
	baseURL string
	http    *http.Client
}

func NewProfileClient(baseURL string) *ProfileClient {
	return &ProfileClient{
		baseURL: baseURL,
		http: &http.Client{
			Transport: otelhttp.NewTransport(http.DefaultTransport),
			Timeout:   800 * time.Millisecond,
		},
	}
}

func (c *ProfileClient) Get(ctx context.Context, playerID string) (Profile, error) {
	var p Profile
	err := getJSON(ctx, c.http, fmt.Sprintf("%s/profiles/%s", c.baseURL, playerID), &p)
	return p, err
}

type RatingClient struct {
	baseURL string
	http    *http.Client
}

func NewRatingClient(baseURL string) *RatingClient {
	return &RatingClient{
		baseURL: baseURL,
		http: &http.Client{
			Transport: &http.Transport{
				MaxIdleConns:        64,
				MaxIdleConnsPerHost: 32,
				IdleConnTimeout:     90 * time.Second,
			},
			Timeout: 1500 * time.Millisecond,
		},
	}
}

func (c *RatingClient) Get(ctx context.Context, playerID string) (Rating, error) {
	var r Rating
	err := getJSON(ctx, c.http, fmt.Sprintf("%s/ratings/%s", c.baseURL, playerID), &r)
	return r, err
}

func getJSON(ctx context.Context, hc *http.Client, url string, out any) error {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return err
	}
	resp, err := hc.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("GET %s: unexpected status %d", url, resp.StatusCode)
	}
	return json.NewDecoder(resp.Body).Decode(out)
}
