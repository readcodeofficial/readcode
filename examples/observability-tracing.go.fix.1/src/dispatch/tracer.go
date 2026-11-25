package dispatch

import (
	"context"
	"fmt"
	"sync"
)

type SpanRecord struct {
	TraceID  string
	SpanID   string
	ParentID string
	Name     string
	Attrs    map[string]string
}

type Tracer struct {
	mu   sync.Mutex
	seq  int
	done []SpanRecord
}

func NewTracer() *Tracer { return &Tracer{} }

func (t *Tracer) next(prefix string) string {
	t.mu.Lock()
	defer t.mu.Unlock()
	t.seq++
	return fmt.Sprintf("%s-%d", prefix, t.seq)
}

type Span struct {
	t   *Tracer
	rec SpanRecord
}

// StartSpan begins a span as a child of whatever span ctx carries, or as the
// root of a new trace when ctx carries none.
func (t *Tracer) StartSpan(ctx context.Context, name string) (context.Context, *Span) {
	rec := SpanRecord{Name: name, SpanID: t.next("span"), Attrs: map[string]string{}}
	if parent, ok := SpanContextFrom(ctx); ok {
		rec.TraceID = parent.TraceID
		rec.ParentID = parent.SpanID
	} else {
		rec.TraceID = t.next("trace")
	}
	ctx = WithSpanContext(ctx, SpanContext{TraceID: rec.TraceID, SpanID: rec.SpanID})
	return ctx, &Span{t: t, rec: rec}
}

func (s *Span) SetAttr(key, value string) { s.rec.Attrs[key] = value }

// End records the span; spans that never end are never reported.
func (s *Span) End() {
	s.t.mu.Lock()
	defer s.t.mu.Unlock()
	s.t.done = append(s.t.done, s.rec)
}

func (t *Tracer) Finished() []SpanRecord {
	t.mu.Lock()
	defer t.mu.Unlock()
	return append([]SpanRecord(nil), t.done...)
}

// Parallel runs the tasks concurrently, each inside its own span, and waits
// for all of them.
func (t *Tracer) Parallel(ctx context.Context, name string, tasks ...func(context.Context)) {
	var wg sync.WaitGroup
	for i, task := range tasks {
		wg.Add(1)
		go func(i int, task func(context.Context)) {
			defer wg.Done()
			tctx, span := t.StartSpan(context.Background(), fmt.Sprintf("%s[%d]", name, i))
			defer span.End()
			task(tctx)
		}(i, task)
	}
	wg.Wait()
}
