package catalog

import "errors"

var (
	ErrNotFound     = errors.New("catalog: product not found")
	ErrInvalidPrice = errors.New("catalog: price must be positive")
)

// Product is a sellable item. Prices are in cents.
type Product struct {
	ID         string
	Name       string
	PriceCents int64
}

// Store is the system of record (a database in production).
type Store interface {
	Load(id string) (Product, error)
	Save(p Product) error
}
