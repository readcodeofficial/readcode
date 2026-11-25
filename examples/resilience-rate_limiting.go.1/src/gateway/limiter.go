package gateway

import (
	"context"
	"sync"
	"time"

	"golang.org/x/time/rate"
)

type bucket struct {
	lim      *rate.Limiter
	lastSeen time.Time
}

// PlayerLimiter keeps one token bucket per player.
type PlayerLimiter struct {
	mu      sync.Mutex
	buckets map[string]*bucket
	limit   rate.Limit
	burst   int
	idleTTL time.Duration
	now     func() time.Time
}

func NewPlayerLimiter(limit rate.Limit, burst int, idleTTL time.Duration) *PlayerLimiter {
	return &PlayerLimiter{
		buckets: make(map[string]*bucket),
		limit:   limit,
		burst:   burst,
		idleTTL: idleTTL,
		now:     time.Now,
	}
}

func (p *PlayerLimiter) get(playerID string) *rate.Limiter {
	p.mu.Lock()
	defer p.mu.Unlock()

	b, ok := p.buckets[playerID]
	if !ok {
		b = &bucket{lim: rate.NewLimiter(p.limit, p.burst)}
		p.buckets[playerID] = b
	}
	b.lastSeen = p.now()
	return b.lim
}

// Allow reports whether the player may send another request right now.
func (p *PlayerLimiter) Allow(playerID string) bool {
	res := p.get(playerID).Reserve()
	return res.OK()
}

// Sweep drops buckets that have been idle longer than idleTTL.
func (p *PlayerLimiter) Sweep() int {
	p.mu.Lock()
	defer p.mu.Unlock()

	cutoff := p.now().Add(-p.idleTTL)
	removed := 0
	for id, b := range p.buckets {
		if b.lastSeen.Before(cutoff) {
			delete(p.buckets, id)
			removed++
		}
	}
	return removed
}

func (p *PlayerLimiter) RunSweeper(ctx context.Context, every time.Duration) {
	t := time.NewTicker(every)
	defer t.Stop()
	for {
		select {
		case <-ctx.Done():
			return
		case <-t.C:
			p.Sweep()
		}
	}
}
