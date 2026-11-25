package rates

import (
	"fmt"
	"math"
	"sync"
)

// Converter turns amounts in minor units (cents) from one currency into another.
type Converter struct {
	cache *Cache
}

func NewConverter(cache *Cache) *Converter {
	return &Converter{cache: cache}
}

func (c *Converter) Convert(cents int64, from, to string) (int64, error) {
	if from == to {
		return cents, nil
	}
	q, err := c.cache.Get(from + "/" + to)
	if err != nil {
		return 0, fmt.Errorf("convert %s to %s: %w", from, to, err)
	}
	return int64(math.Round(float64(cents) * q.Rate)), nil
}

// ConvertMany converts every amount concurrently, as the invoice export does
// for a customer with many line items.
func (c *Converter) ConvertMany(amounts []int64, from, to string) ([]int64, error) {
	out := make([]int64, len(amounts))
	errs := make([]error, len(amounts))
	var wg sync.WaitGroup
	for i, a := range amounts {
		wg.Add(1)
		go func(i int, a int64) {
			defer wg.Done()
			out[i], errs[i] = c.Convert(a, from, to)
		}(i, a)
	}
	wg.Wait()
	for _, err := range errs {
		if err != nil {
			return nil, err
		}
	}
	return out, nil
}
