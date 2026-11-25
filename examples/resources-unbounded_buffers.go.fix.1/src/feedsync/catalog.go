package feedsync

import (
	"context"
	"sync"
)

// Catalog is the local copy of a supplier's price list.
type Catalog struct {
	Fetcher *Fetcher

	mu    sync.RWMutex
	items map[string]Item
}

func NewCatalog(f *Fetcher) *Catalog {
	return &Catalog{Fetcher: f, items: map[string]Item{}}
}

// Sync replaces the catalog with the feed at url. On any error the previous
// catalog is kept.
func (c *Catalog) Sync(ctx context.Context, url string) (int, error) {
	data, err := c.Fetcher.Get(ctx, url)
	if err != nil {
		return 0, err
	}
	items, err := DecodeFeed(data)
	if err != nil {
		return 0, err
	}
	next := make(map[string]Item, len(items))
	for _, it := range items {
		next[it.SKU] = it
	}
	c.mu.Lock()
	c.items = next
	c.mu.Unlock()
	return len(items), nil
}

func (c *Catalog) Price(sku string) (int, bool) {
	c.mu.RLock()
	defer c.mu.RUnlock()
	it, ok := c.items[sku]
	return it.PriceCents, ok
}

func (c *Catalog) Len() int {
	c.mu.RLock()
	defer c.mu.RUnlock()
	return len(c.items)
}
