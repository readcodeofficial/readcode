package rates

import (
	"sync"
	"time"
)

type entry struct {
	quote   Quote
	expires time.Time
}

// Cache keeps quotes for ttl so the provider is not called for every
// conversion. It is safe for concurrent use.
type Cache struct {
	mu      sync.Mutex
	ttl     time.Duration
	clock   Clock
	load    Loader
	entries map[string]entry
}

func NewCache(load Loader, ttl time.Duration, clock Clock) *Cache {
	return &Cache{
		ttl:     ttl,
		clock:   clock,
		load:    load,
		entries: make(map[string]entry),
	}
}

// Get returns the cached quote for pair, loading it when missing or expired.
func (c *Cache) Get(pair string) (Quote, error) {
	c.mu.Lock()
	if e, ok := c.entries[pair]; ok && c.clock.Now().Before(e.expires) {
		c.mu.Unlock()
		return e.quote, nil
	}
	c.mu.Unlock()

	q, err := c.load(pair)
	if err != nil {
		return Quote{}, err
	}

	c.mu.Lock()
	c.entries[pair] = entry{quote: q, expires: c.clock.Now().Add(c.ttl)}
	c.mu.Unlock()
	return q, nil
}

// Invalidate drops the cached quote for pair.
func (c *Cache) Invalidate(pair string) {
	c.mu.Lock()
	delete(c.entries, pair)
	c.mu.Unlock()
}
