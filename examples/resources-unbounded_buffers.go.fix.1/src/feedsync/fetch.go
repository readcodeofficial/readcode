package feedsync

import (
	"context"
	"errors"
	"fmt"
	"io"
	"net/http"
)

var ErrTooLarge = errors.New("feed exceeds size limit")

// Doer is the part of *http.Client the fetcher needs.
type Doer interface {
	Do(req *http.Request) (*http.Response, error)
}

// Fetcher downloads a supplier feed into memory, refusing bodies larger
// than MaxBytes.
type Fetcher struct {
	Client   Doer
	MaxBytes int64
}

func (f *Fetcher) Get(ctx context.Context, url string) ([]byte, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return nil, err
	}
	resp, err := f.Client.Do(req)
	if err != nil {
		return nil, fmt.Errorf("fetch %s: %w", url, err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("fetch %s: status %d", url, resp.StatusCode)
	}
	body, err := io.ReadAll(io.LimitReader(resp.Body, f.MaxBytes))
	if err != nil {
		return nil, fmt.Errorf("read %s: %w", url, err)
	}
	return body, nil
}
