package dispatch

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"time"
)

type Job struct {
	ID         string
	RestaurantID string
	DropoffLat float64
	DropoffLng float64
}

type Quote struct {
	Provider  string
	CourierID string
	ETA       time.Duration
}

type Provider interface {
	Name() string
	Quote(ctx context.Context, job Job) (Quote, error)
}

type Dispatcher struct {
	providers []Provider
	deadline  time.Duration
	log       *slog.Logger
}

func NewDispatcher(providers []Provider, deadline time.Duration, log *slog.Logger) *Dispatcher {
	return &Dispatcher{providers: providers, deadline: deadline, log: log}
}

type outcome struct {
	provider string
	quote    Quote
	err      error
}

// Assign asks every courier provider for a quote and returns the first one
// that succeeds.
func (d *Dispatcher) Assign(ctx context.Context, job Job) (Quote, error) {
	ctx, cancel := context.WithTimeout(ctx, d.deadline)
	defer cancel()

	outcomes := make(chan outcome, len(d.providers))
	for _, p := range d.providers {
		go func(p Provider) {
			q, err := p.Quote(ctx, job)
			outcomes <- outcome{provider: p.Name(), quote: q, err: err}
		}(p)
	}

	var failures []error
	for range d.providers {
		select {
		case o := <-outcomes:
			if o.err != nil {
				d.log.Warn("provider quote failed", "job", job.ID, "provider", o.provider, "err", o.err)
				failures = append(failures, fmt.Errorf("%s: %w", o.provider, o.err))
				continue
			}
			return o.quote, nil
		case <-ctx.Done():
			return Quote{}, fmt.Errorf("assign job %s: %w", job.ID, ctx.Err())
		}
	}
	return Quote{}, fmt.Errorf("assign job %s: no provider could serve it: %w", job.ID, errors.Join(failures...))
}
