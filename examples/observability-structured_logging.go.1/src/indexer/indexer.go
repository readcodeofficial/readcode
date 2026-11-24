package indexer

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"

	"searchsvc/logging"
)

type Doc struct {
	ID     string         `json:"id"`
	Fields map[string]any `json:"fields"`
}

type Batch struct {
	Index string
	Docs  []Doc
}

type bulkResponse struct {
	Errors bool `json:"errors"`
	Items  []struct {
		ID     string `json:"id"`
		Status int    `json:"status"`
		Reason string `json:"reason"`
	} `json:"items"`
}

type Indexer struct {
	endpoint string
	client   *http.Client
}

func New(endpoint string, client *http.Client) *Indexer {
	return &Indexer{endpoint: endpoint, client: client}
}

func (ix *Indexer) IndexBatch(ctx context.Context, batch Batch) error {
	l := logging.From(ctx).With("index", batch.Index)
	l.Debug("indexing batch", "docs", len(batch.Docs))

	payload, err := json.Marshal(batch.Docs)
	if err != nil {
		l.Error("encode batch", "err", err)
		return fmt.Errorf("encode batch for %s: %w", batch.Index, err)
	}

	req, err := http.NewRequestWithContext(ctx, http.MethodPost,
		ix.endpoint+"/"+batch.Index+"/_bulk", bytes.NewReader(payload))
	if err != nil {
		return fmt.Errorf("build bulk request: %w", err)
	}
	req.Header.Set("Content-Type", "application/json")

	resp, err := ix.client.Do(req)
	if err != nil {
		l.Error("bulk request failed", "err", err, "docs", len(batch.Docs))
		return fmt.Errorf("bulk request to %s: %w", batch.Index, err)
	}
	defer resp.Body.Close()

	if resp.StatusCode >= 300 {
		l.Error("bulk index rejected", "docs", len(batch.Docs), resp.Status)
		return fmt.Errorf("bulk index %s: status %d", batch.Index, resp.StatusCode)
	}

	var out bulkResponse
	if err := json.NewDecoder(resp.Body).Decode(&out); err != nil {
		l.Error("decode bulk response", "err", err)
		return fmt.Errorf("decode bulk response: %w", err)
	}

	failed := 0
	for _, item := range out.Items {
		if item.Status >= 300 {
			failed++
			l.Warn("document not indexed",
				slog_attrs(item.ID, item.Status, item.Reason)...)
		}
	}
	l.Info("batch indexed",
		"docs", len(batch.Docs),
		"failed", failed)
	if failed > 0 {
		return fmt.Errorf("%d of %d documents failed", failed, len(batch.Docs))
	}
	return nil
}

func slog_attrs(id string, status int, reason string) []any {
	return []any{"doc_id", id, "status", status, "reason", reason}
}
