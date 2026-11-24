package runner

import (
	"context"
	"errors"
	"log/slog"
	"sync/atomic"
	"time"
)

var ErrAtCapacity = errors.New("runner: at capacity")

type Job struct {
	ID   string
	Repo string
	Run  func(ctx context.Context) error
}

type Limits struct {
	MaxConcurrent int64
	JobTimeout    time.Duration
}

type Stats struct {
	Started    atomic.Int64
	Succeeded  atomic.Int64
	Failed     atomic.Int64
	TotalNanos atomic.Int64
}

type Pool struct {
	limits  atomic.Pointer[Limits]
	running atomic.Int64
	stats   Stats
	log     *slog.Logger
}

func NewPool(initial Limits, log *slog.Logger) *Pool {
	p := &Pool{log: log}
	p.limits.Store(&initial)
	return p
}

func (p *Pool) SetLimits(l Limits) {
	p.limits.Store(&l)
}

func (p *Pool) Submit(ctx context.Context, job Job) error {
	lim := p.limits.Load()
	if p.running.Load() >= lim.MaxConcurrent {
		return ErrAtCapacity
	}
	p.running.Add(1)
	p.stats.Started.Add(1)

	go p.execute(context.WithoutCancel(ctx), lim, job)
	return nil
}

func (p *Pool) execute(ctx context.Context, lim *Limits, job Job) {
	defer p.running.Add(-1)

	ctx, cancel := context.WithTimeout(ctx, lim.JobTimeout)
	defer cancel()

	start := time.Now()
	err := job.Run(ctx)
	p.stats.TotalNanos.Add(int64(time.Since(start)))

	if err != nil {
		p.stats.Failed.Add(1)
		p.log.Warn("job failed", "job", job.ID, "repo", job.Repo, "err", err)
		return
	}
	p.stats.Succeeded.Add(1)
}
