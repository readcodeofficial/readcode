package bins

// Move transfers qty units from one bin to another. Bins are always locked in
// ID order so that opposite transfers between the same two bins cannot wait on
// each other.
func (r *Registry) Move(fromID, toID string, qty int) error {
	if qty <= 0 {
		return ErrBadQuantity
	}
	from, err := r.lookup(fromID)
	if err != nil {
		return err
	}
	to, err := r.lookup(toID)
	if err != nil {
		return err
	}

	first, second := from, to
	if second.id < first.id {
		first, second = second, first
	}
	first.mu.Lock()
	defer first.mu.Unlock()
	second.mu.Lock()
	defer second.mu.Unlock()

	if from.qty < qty {
		return ErrInsufficient
	}
	from.qty -= qty
	to.qty += qty
	r.record(Movement{From: fromID, To: toID, Qty: qty})
	return nil
}
