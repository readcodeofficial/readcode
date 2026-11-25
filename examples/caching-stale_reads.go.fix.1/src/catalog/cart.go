package catalog

import "fmt"

// Item is one line of a shopping cart.
type Item struct {
	ProductID string
	Qty       int
}

// CartTotal prices a cart at the catalog's current prices, in cents.
func CartTotal(c *Catalog, items []Item) (int64, error) {
	var total int64
	for _, it := range items {
		p, err := c.Get(it.ProductID)
		if err != nil {
			return 0, fmt.Errorf("price %s: %w", it.ProductID, err)
		}
		total += p.PriceCents * int64(it.Qty)
	}
	return total, nil
}
