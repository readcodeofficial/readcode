package dispatch

import (
	"context"
	"errors"
	"log/slog"
	"time"

	"golang.org/x/sync/errgroup"
)

var ErrNoDriver = errors.New("dispatch: no driver accepted the trip")

const (
	offerWindow    = 8 * time.Second
	maxParallelOut = 5
)

type Offerer interface {
	Offer(ctx context.Context, driverID string, trip Trip) (bool, error)
}

type Dispatcher struct {
	offers Offerer
	log    *slog.Logger
}

func NewDispatcher(offers Offerer, log *slog.Logger) *Dispatcher {
	return &Dispatcher{offers: offers, log: log}
}

// Assign offers the trip to the candidates in parallel and returns the first driver to accept.
func (d *Dispatcher) Assign(ctx context.Context, trip Trip, candidates []Driver) (Driver, error) {
	ctx, cancel := context.WithTimeout(ctx, offerWindow)
	defer cancel()

	winner := make(chan Driver, 1)

	var g errgroup.Group
	g.SetLimit(maxParallelOut)
	for _, cand := range candidates {
		cand := cand
		g.Go(func() error {
			if ctx.Err() != nil {
				return nil
			}
			accepted, err := d.offers.Offer(ctx, cand.ID, trip)
			switch {
			case err != nil && !errors.Is(err, context.Canceled):
				d.log.Warn("offer failed", "trip", trip.ID, "driver", cand.ID, "err", err)
			case accepted:
				select {
				case winner <- cand:
					cancel()
				default:
				}
			}
			return nil
		})
	}
	_ = g.Wait()

	select {
	case drv := <-winner:
		return drv, nil
	default:
	}
	if err := ctx.Err(); err != nil {
		return Driver{}, err
	}
	return Driver{}, ErrNoDriver
}
