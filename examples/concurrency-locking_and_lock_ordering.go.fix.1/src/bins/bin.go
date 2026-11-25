package bins

import (
	"errors"
	"sync"
)

var (
	ErrUnknownBin   = errors.New("bins: unknown bin")
	ErrInsufficient = errors.New("bins: not enough stock in source bin")
	ErrBadQuantity  = errors.New("bins: quantity must be positive")
)

// bin is one physical shelf location holding units of a single SKU.
type bin struct {
	id  string
	mu  sync.Mutex
	qty int
}

// Movement is one completed transfer, kept for the audit trail.
type Movement struct {
	From, To string
	Qty      int
}
