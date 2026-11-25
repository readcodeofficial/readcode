package rates

import (
	"errors"
	"time"
)

// Quote is an exchange rate for a currency pair such as "EUR/USD".
type Quote struct {
	Pair      string
	Rate      float64
	FetchedAt time.Time
}

// Loader fetches a fresh quote from the upstream provider. It is slow and
// the provider rate-limits callers.
type Loader func(pair string) (Quote, error)

type Clock interface {
	Now() time.Time
}

type SystemClock struct{}

func (SystemClock) Now() time.Time { return time.Now() }

var ErrUnknownPair = errors.New("rates: unknown currency pair")
