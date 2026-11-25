package tickets

import "sync"

// MemoryInventory is a counter table: Take is a plain decrement, like
// "UPDATE seats SET remaining = remaining - n".
type MemoryInventory struct {
	mu     sync.Mutex
	counts map[string]int
}

func NewMemoryInventory(counts map[string]int) *MemoryInventory {
	copied := make(map[string]int, len(counts))
	for k, v := range counts {
		copied[k] = v
	}
	return &MemoryInventory{counts: copied}
}

func (m *MemoryInventory) Remaining(event string) (int, error) {
	m.mu.Lock()
	defer m.mu.Unlock()
	left, ok := m.counts[event]
	if !ok {
		return 0, ErrUnknownEvent
	}
	return left, nil
}

func (m *MemoryInventory) Take(event string, n int) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	if _, ok := m.counts[event]; !ok {
		return ErrUnknownEvent
	}
	m.counts[event] -= n
	return nil
}
