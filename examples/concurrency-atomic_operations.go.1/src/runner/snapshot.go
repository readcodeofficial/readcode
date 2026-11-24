package runner

import (
	"context"
	"time"
)

type Snapshot struct {
	Running   int64
	Started   int64
	Succeeded int64
	Failed    int64
	MeanRun   time.Duration
}

func (p *Pool) Snapshot() Snapshot {
	s := Snapshot{
		Running:   p.running.Load(),
		Started:   p.stats.Started.Load(),
		Succeeded: p.stats.Succeeded.Load(),
		Failed:    p.stats.Failed.Load(),
	}
	done := s.Succeeded + s.Failed
	if done > 0 {
		s.MeanRun = time.Duration(p.stats.TotalNanos.Load() / done)
	}
	return s
}

func (p *Pool) Drain(ctx context.Context) error {
	t := time.NewTicker(50 * time.Millisecond)
	defer t.Stop()
	for p.running.Load() > 0 {
		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-t.C:
		}
	}
	return nil
}
