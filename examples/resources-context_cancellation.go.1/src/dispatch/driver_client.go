package dispatch

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
)

type Trip struct {
	ID       string  `json:"id"`
	PickupLt float64 `json:"pickup_lat"`
	PickupLn float64 `json:"pickup_lng"`
	FareCent int     `json:"fare_cents"`
}

type Driver struct {
	ID string
}

type DriverClient struct {
	baseURL string
	http    *http.Client
}

func NewDriverClient(baseURL string, hc *http.Client) *DriverClient {
	return &DriverClient{baseURL: baseURL, http: hc}
}

// Offer asks one driver to take the trip and reports whether they accepted.
func (c *DriverClient) Offer(ctx context.Context, driverID string, trip Trip) (bool, error) {
	body, err := json.Marshal(trip)
	if err != nil {
		return false, fmt.Errorf("encode trip %s: %w", trip.ID, err)
	}

	url := fmt.Sprintf("%s/drivers/%s/offers", c.baseURL, driverID)
	req, err := http.NewRequestWithContext(context.Background(), http.MethodPost, url, bytes.NewReader(body))
	if err != nil {
		return false, fmt.Errorf("build offer request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.http.Do(req)
	if err != nil {
		return false, fmt.Errorf("offer to driver %s: %w", driverID, err)
	}
	defer resp.Body.Close()

	switch resp.StatusCode {
	case http.StatusOK:
		return true, nil
	case http.StatusConflict, http.StatusGone:
		return false, nil
	default:
		return false, fmt.Errorf("offer to driver %s: unexpected status %d", driverID, resp.StatusCode)
	}
}
