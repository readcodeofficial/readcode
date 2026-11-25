package tickets

import "sync"

// BoxOffice hands out seat holds against an Inventory.
type BoxOffice struct {
	inv   Inventory
	mu    sync.Mutex
	holds map[string]int
}

func NewBoxOffice(inv Inventory) *BoxOffice {
	return &BoxOffice{inv: inv, holds: make(map[string]int)}
}

// Hold reserves n seats for the event, or returns ErrSoldOut if fewer remain.
func (b *BoxOffice) Hold(event string, n int) error {
	if n <= 0 {
		return ErrBadQuantity
	}
	left, err := b.inv.Remaining(event)
	if err != nil {
		return err
	}
	if left < n {
		return ErrSoldOut
	}
	b.mu.Lock()
	defer b.mu.Unlock()
	if err := b.inv.Take(event, n); err != nil {
		return err
	}
	b.holds[event] += n
	return nil
}

// Held returns how many seats this box office has held for the event.
func (b *BoxOffice) Held(event string) int {
	b.mu.Lock()
	defer b.mu.Unlock()
	return b.holds[event]
}
