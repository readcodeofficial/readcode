package main

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"sync"
)

var (
	ErrBusy   = errors.New("pay run queue is full")
	ErrClosed = errors.New("pay run runner is shutting down")
)

type Runner struct {
	store   Store
	log     *slog.Logger
	workers int
	queue   chan PayRun
	wg      sync.WaitGroup

	mu     sync.Mutex
	closed bool

	baseCtx context.Context
	abort   context.CancelFunc
}

func NewRunner(store Store, log *slog.Logger, workers, depth int) *Runner {
	base, abort := context.WithCancel(context.Background())
	return &Runner{
		store:   store,
		log:     log,
		workers: workers,
		queue:   make(chan PayRun, depth),
		baseCtx: base,
		abort:   abort,
	}
}

func (r *Runner) Start() {
	for i := 0; i < r.workers; i++ {
		r.wg.Add(1)
		go func() {
			defer r.wg.Done()
			for run := range r.queue {
				r.process(run)
			}
		}()
	}
}

func (r *Runner) Submit(run PayRun) error {
	r.mu.Lock()
	defer r.mu.Unlock()
	if r.closed {
		return ErrClosed
	}
	select {
	case r.queue <- run:
		r.store.SetStatus(run.ID, StatusQueued)
		return nil
	default:
		return ErrBusy
	}
}

// Drain stops accepting work and waits for queued pay runs to finish. If ctx
// expires first, the remaining runs are interrupted and left for a retry.
func (r *Runner) Drain(ctx context.Context) error {
	r.mu.Lock()
	if !r.closed {
		r.closed = true
		close(r.queue)
	}
	r.mu.Unlock()

	done := make(chan struct{})
	go func() {
		r.wg.Wait()
		close(done)
	}()

	select {
	case <-done:
		return nil
	case <-ctx.Done():
		r.abort()
		<-done
		return fmt.Errorf("drain interrupted: %w", ctx.Err())
	}
}

func (r *Runner) process(run PayRun) {
	r.store.SetStatus(run.ID, StatusRunning)
	for _, emp := range run.Employees {
		if r.baseCtx.Err() != nil {
			r.store.SetStatus(run.ID, StatusInterrupted)
			return
		}
		if err := r.store.SaveLine(r.baseCtx, run.ID, emp); err != nil {
			r.store.SetStatus(run.ID, StatusFailed)
			r.log.Error("pay line failed", "run", run.ID, "employee", emp, "err", err)
			return
		}
	}
	r.store.SetStatus(run.ID, StatusComplete)
}
