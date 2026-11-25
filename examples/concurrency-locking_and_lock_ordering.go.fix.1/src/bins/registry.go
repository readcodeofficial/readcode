package bins

import "sync"

// Registry owns the bins of one warehouse and the movement log.
type Registry struct {
	bins map[string]*bin

	logMu sync.Mutex
	log   []Movement
}

// NewRegistry creates a registry from starting quantities per bin ID.
func NewRegistry(stock map[string]int) *Registry {
	r := &Registry{bins: make(map[string]*bin, len(stock))}
	for id, qty := range stock {
		r.bins[id] = &bin{id: id, qty: qty}
	}
	return r
}

func (r *Registry) lookup(id string) (*bin, error) {
	b, ok := r.bins[id]
	if !ok {
		return nil, ErrUnknownBin
	}
	return b, nil
}

// Qty returns the current quantity in a bin.
func (r *Registry) Qty(id string) (int, error) {
	b, err := r.lookup(id)
	if err != nil {
		return 0, err
	}
	b.mu.Lock()
	defer b.mu.Unlock()
	return b.qty, nil
}

// Total returns the units across every bin (locks one bin at a time).
func (r *Registry) Total() int {
	total := 0
	for _, b := range r.bins {
		b.mu.Lock()
		total += b.qty
		b.mu.Unlock()
	}
	return total
}

func (r *Registry) record(m Movement) {
	r.logMu.Lock()
	defer r.logMu.Unlock()
	r.log = append(r.log, m)
}

// Movements returns a copy of the audit trail.
func (r *Registry) Movements() []Movement {
	r.logMu.Lock()
	defer r.logMu.Unlock()
	return append([]Movement(nil), r.log...)
}
