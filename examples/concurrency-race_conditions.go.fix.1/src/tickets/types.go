package tickets

import "errors"

var (
	ErrSoldOut      = errors.New("tickets: not enough seats left")
	ErrUnknownEvent = errors.New("tickets: unknown event")
	ErrBadQuantity  = errors.New("tickets: quantity must be positive")
)

// Inventory is the seat counter owned by the ticketing database.
type Inventory interface {
	Remaining(event string) (int, error)
	Take(event string, n int) error
}
