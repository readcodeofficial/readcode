package menus

import (
	"context"
	"fmt"
	"io"
	"net/http"
	"os"
	"time"
)

type Fetcher struct {
	client  *http.Client
	baseURL string
	tmpDir  string
}

func NewFetcher(baseURL, tmpDir string) *Fetcher {
	return &Fetcher{
		client:  &http.Client{Timeout: 30 * time.Second},
		baseURL: baseURL,
		tmpDir:  tmpDir,
	}
}

// Fetch downloads a restaurant's menu feed to a temp file and returns its path.
// The caller removes the file once it has been imported.
func (f *Fetcher) Fetch(ctx context.Context, restaurantID string) (string, error) {
	url := fmt.Sprintf("%s/restaurants/%s/menu.csv", f.baseURL, restaurantID)
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, url, nil)
	if err != nil {
		return "", fmt.Errorf("build menu request: %w", err)
	}

	resp, err := f.client.Do(req)
	if err != nil {
		return "", fmt.Errorf("fetch menu for %s: %w", restaurantID, err)
	}
	if resp.StatusCode != http.StatusOK {
		return "", fmt.Errorf("menu feed for %s returned status %d", restaurantID, resp.StatusCode)
	}
	defer resp.Body.Close()

	tmp, err := os.CreateTemp(f.tmpDir, "menu-"+restaurantID+"-*.csv")
	if err != nil {
		return "", fmt.Errorf("create temp file: %w", err)
	}

	if _, err := io.Copy(tmp, io.LimitReader(resp.Body, maxFeedBytes)); err != nil {
		tmp.Close()
		os.Remove(tmp.Name())
		return "", fmt.Errorf("download menu for %s: %w", restaurantID, err)
	}
	if err := tmp.Close(); err != nil {
		os.Remove(tmp.Name())
		return "", fmt.Errorf("flush menu file: %w", err)
	}
	return tmp.Name(), nil
}

const maxFeedBytes = 8 << 20
