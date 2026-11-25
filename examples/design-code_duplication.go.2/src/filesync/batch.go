package filesync

import (
	"context"
	"errors"
	"fmt"

	"golang.org/x/sync/errgroup"
)

// runBatch applies fn to every item with at most limit calls in flight. It
// always attempts every item (one failure does not cancel the others) and
// returns all failures joined, each tagged with the item's label.
func runBatch[T any](ctx context.Context, limit int, items []T, label func(T) string,
	fn func(context.Context, T) error) error {

	var g errgroup.Group
	g.SetLimit(limit)
	errs := make([]error, len(items))

	for i, item := range items {
		if err := ctx.Err(); err != nil {
			errs[i] = err
			break
		}
		i, item := i, item
		g.Go(func() error {
			if err := fn(ctx, item); err != nil {
				errs[i] = fmt.Errorf("%s: %w", label(item), err)
			}
			return nil
		})
	}
	_ = g.Wait()
	return errors.Join(errs...)
}
