package dispatch

import (
	"context"
	"net/http"
)

// Service accepts new delivery orders and hands them to the restaurant.
type Service struct {
	Tracer     *Tracer
	Restaurant func(h http.Header) error
}

func (s *Service) HandleOrder(ctx context.Context, in http.Header, orderID string) error {
	ctx = Extract(ctx, in)
	ctx, span := s.Tracer.StartSpan(ctx, "handle_order")
	defer span.End()
	span.SetAttr("order_id", orderID)

	s.Tracer.Parallel(ctx, "prepare",
		func(c context.Context) { s.assignCourier(c) },
		func(c context.Context) { s.quoteFare(c) },
	)

	out := http.Header{}
	Inject(ctx, out)
	if err := s.Restaurant(out); err != nil {
		span.SetAttr("error", err.Error())
		return err
	}
	return nil
}

func (s *Service) assignCourier(ctx context.Context) {
	_, span := s.Tracer.StartSpan(ctx, "assign_courier")
	defer span.End()
}

func (s *Service) quoteFare(ctx context.Context) {
	_, span := s.Tracer.StartSpan(ctx, "quote_fare")
	defer span.End()
}
