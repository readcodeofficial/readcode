package dispatch

import (
	"context"
	"net/http"
)

const (
	HeaderTraceID    = "X-Trace-Id"
	HeaderParentSpan = "X-Parent-Span-Id"
)

// Inject copies the active span into outgoing request headers.
func Inject(ctx context.Context, h http.Header) {
	sc, ok := SpanContextFrom(ctx)
	if !ok {
		return
	}
	h.Set(HeaderTraceID, sc.TraceID)
	h.Set(HeaderParentSpan, sc.SpanID)
}

// Extract continues a trace started by an upstream caller, if there is one.
func Extract(ctx context.Context, h http.Header) context.Context {
	traceID := h.Get(HeaderTraceID)
	if traceID == "" {
		return ctx
	}
	return WithSpanContext(ctx, SpanContext{TraceID: traceID, SpanID: h.Get(HeaderParentSpan)})
}
