package notify

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
)

type Outcome int

const (
	Ack Outcome = iota
	Drop
	Retry
)

type Dispatcher struct {
	channels []Channel
	log      *slog.Logger
}

func NewDispatcher(log *slog.Logger, channels ...Channel) *Dispatcher {
	return &Dispatcher{channels: channels, log: log}
}

func (d *Dispatcher) Dispatch(ctx context.Context, msg Message) error {
	var failures []error
	for _, ch := range d.channels {
		if err := ctx.Err(); err != nil {
			return fmt.Errorf("dispatch %s: %w", msg.ID, err)
		}
		err := ch.Send(ctx, msg)
		switch {
		case err == nil:
			d.log.Info("delivered", "message", msg.ID, "channel", ch.Name())
			return nil
		case errors.Is(err, ErrUnsubscribed):
			d.log.Info("recipient opted out", "message", msg.ID, "channel", ch.Name())
		default:
			d.log.Warn("channel failed", "message", msg.ID, "channel", ch.Name(), "err", err)
			failures = append(failures, err)
		}
	}
	if len(failures) == 0 {
		return fmt.Errorf("dispatch %s: %w", msg.ID, ErrNoChannels)
	}
	return fmt.Errorf("dispatch %s: %w", msg.ID, errors.Join(failures...))
}

func (d *Dispatcher) Process(ctx context.Context, msg Message) Outcome {
	err := d.Dispatch(ctx, msg)
	switch {
	case err == nil:
		return Ack
	case errors.Is(err, ErrNoChannels):
		return Drop
	case errors.Is(err, context.Canceled):
		return Retry
	default:
		var pe *ProviderError
		if errors.As(err, &pe) && pe.Status >= 400 && pe.Status < 500 && !errors.Is(err, ErrRateLimited) {
			return Drop
		}
		return Retry
	}
}
