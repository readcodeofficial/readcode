package courierfeed

import (
	"context"
	"time"
)

type Event struct {
	OrderID   string    `json:"order_id"`
	CourierID string    `json:"courier_id"`
	Lat       float64   `json:"lat"`
	Lng       float64   `json:"lng"`
	At        time.Time `json:"at"`
}

// Sink persists a batch of courier location events downstream.
type Sink interface {
	Write(ctx context.Context, batch []Event) error
}
