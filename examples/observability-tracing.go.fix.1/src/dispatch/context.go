package dispatch

import "context"

// SpanContext identifies the span that is currently active for a request.
type SpanContext struct {
	TraceID string
	SpanID  string
}

type ctxKey struct{}

func WithSpanContext(ctx context.Context, sc SpanContext) context.Context {
	return context.WithValue(ctx, ctxKey{}, sc)
}

func SpanContextFrom(ctx context.Context) (SpanContext, bool) {
	sc, ok := ctx.Value(ctxKey{}).(SpanContext)
	return sc, ok
}
