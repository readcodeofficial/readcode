package catalog

// Catalog serves product reads through a cache and applies price updates.
type Catalog struct {
	store Store
	cache *Cache
}

func New(store Store, cache *Cache) *Catalog {
	return &Catalog{store: store, cache: cache}
}

// Get returns the product, reading through to the store on a cache miss.
func (c *Catalog) Get(id string) (Product, error) {
	if p, ok := c.cache.Get(id); ok {
		return p, nil
	}
	p, err := c.store.Load(id)
	if err != nil {
		return Product{}, err
	}
	c.cache.Set(id, p)
	return p, nil
}

// UpdatePrice changes the price of a product.
func (c *Catalog) UpdatePrice(id string, cents int64) error {
	if cents <= 0 {
		return ErrInvalidPrice
	}
	p, err := c.store.Load(id)
	if err != nil {
		return err
	}
	p.PriceCents = cents

	c.cache.Delete(id)
	return c.store.Save(p)
}
