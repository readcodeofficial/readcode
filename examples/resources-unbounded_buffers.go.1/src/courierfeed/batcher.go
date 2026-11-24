package courierfeed

import (
	"context"
	"log/slog"
	"sync/atomic"
	"time"
)

type Batcher struct {
	sink       Sink
	in         chan Event
	maxBatch   int
	maxPending int
	flushEvery time.Duration
	pending    []Event
	dropped    atomic.Int64
}

func NewBatcher(sink Sink, queue, maxBatch, maxPending int, flushEvery time.Duration) *Batcher {
	return &Batcher{
		sink:       sink,
		in:         make(chan Event, queue),
		maxBatch:   maxBatch,
		maxPending: maxPending,
		flushEvery: flushEvery,
		pending:    make([]Event, 0, maxBatch),
	}
}

// Offer never blocks: it reports false when the intake queue is full.
func (b *Batcher) Offer(ev Event) bool {
	select {
	case b.in <- ev:
		return true
	default:
		b.dropped.Add(1)
		return false
	}
}

func (b *Batcher) Dropped() int64 { return b.dropped.Load() }

func (b *Batcher) Run(ctx context.Context) {
	ticker := time.NewTicker(b.flushEvery)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			final, cancel := context.WithTimeout(context.Background(), 5*time.Second)
			b.flush(final)
			cancel()
			return
		case ev := <-b.in:
			if len(b.pending) >= b.maxPending {
				b.dropped.Add(1)
				continue
			}
			b.pending = append(b.pending, ev)
			if len(b.pending) >= b.maxBatch {
				b.flush(ctx)
			}
		case <-ticker.C:
			b.flush(ctx)
		}
	}
}

func (b *Batcher) flush(ctx context.Context) {
	if len(b.pending) == 0 {
		return
	}
	n := min(len(b.pending), b.maxBatch)
	batch := make([]Event, n)
	copy(batch, b.pending[:n])

	wctx, cancel := context.WithTimeout(ctx, 3*time.Second)
	defer cancel()
	if err := b.sink.Write(wctx, batch); err != nil {
		slog.Warn("courier feed flush failed", "events", n, "err", err)
		return
	}
	b.pending = append(b.pending[:0], b.pending[n:]...)
}
