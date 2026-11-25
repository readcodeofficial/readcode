package catalog

import "sync"

// Cache is a goroutine-safe in-process product cache.
type Cache struct {
	mu    sync.RWMutex
	items map[string]Product
}

func NewCache() *Cache {
	return &Cache{items: make(map[string]Product)}
}

func (c *Cache) Get(id string) (Product, bool) {
	c.mu.RLock()
	defer c.mu.RUnlock()
	p, ok := c.items[id]
	return p, ok
}

func (c *Cache) Set(id string, p Product) {
	c.mu.Lock()
	c.items[id] = p
	c.mu.Unlock()
}

func (c *Cache) Delete(id string) {
	c.mu.Lock()
	delete(c.items, id)
	c.mu.Unlock()
}
