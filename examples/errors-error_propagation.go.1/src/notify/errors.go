package notify

import (
	"errors"
	"fmt"
)

var (
	ErrUnsubscribed = errors.New("recipient unsubscribed")
	ErrRateLimited  = errors.New("provider rate limited")
	ErrNoChannels   = errors.New("no deliverable channel")
)

type ProviderError struct {
	Provider string
	Status   int
	Err      error
}

func (e *ProviderError) Error() string {
	return fmt.Sprintf("%s returned %d: %v", e.Provider, e.Status, e.Err)
}

func (e *ProviderError) Unwrap() error { return e.Err }
