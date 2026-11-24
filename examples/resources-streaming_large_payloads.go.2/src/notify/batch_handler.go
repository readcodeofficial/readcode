package notify

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"net/http"
	"strings"
)

const (
	maxBodyBytes = 512 << 20
	flushSize    = 500
)

var errMalformed = errors.New("malformed batch")

type Message struct {
	Recipient  string            `json:"recipient"`
	Channel    string            `json:"channel"`
	TemplateID string            `json:"template_id"`
	Params     map[string]string `json:"params"`
}

type Publisher interface {
	PublishBatch(ctx context.Context, campaignID string, msgs []Message) error
}

type BatchHandler struct {
	pub Publisher
	log *slog.Logger
}

func NewBatchHandler(pub Publisher, log *slog.Logger) *BatchHandler {
	return &BatchHandler{pub: pub, log: log}
}

type batchResult struct {
	Accepted int `json:"accepted"`
	Rejected int `json:"rejected"`
}

func (h *BatchHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	body := http.MaxBytesReader(w, r.Body, maxBodyBytes)
	defer body.Close()

	res, err := h.consume(r.Context(), json.NewDecoder(body))

	var tooBig *http.MaxBytesError
	switch {
	case errors.As(err, &tooBig):
		h.reply(w, http.StatusRequestEntityTooLarge, res)
	case errors.Is(err, errMalformed):
		h.reply(w, http.StatusBadRequest, res)
	case err != nil:
		h.log.Error("batch failed", "accepted", res.Accepted, "err", err)
		h.reply(w, http.StatusBadGateway, res)
	default:
		h.reply(w, http.StatusAccepted, res)
	}
}

func (h *BatchHandler) consume(ctx context.Context, dec *json.Decoder) (batchResult, error) {
	var res batchResult
	if err := expectDelim(dec, '{'); err != nil {
		return res, err
	}

	campaignID := ""
	for dec.More() {
		tok, err := dec.Token()
		if err != nil {
			return res, wrap(err)
		}
		switch tok {
		case "campaign_id":
			if err := dec.Decode(&campaignID); err != nil {
				return res, wrap(err)
			}
		case "messages":
			if err := h.streamMessages(ctx, dec, campaignID, &res); err != nil {
				return res, err
			}
		default:
			var skipped json.RawMessage
			if err := dec.Decode(&skipped); err != nil {
				return res, wrap(err)
			}
		}
	}
	return res, expectDelim(dec, '}')
}

func (h *BatchHandler) streamMessages(ctx context.Context, dec *json.Decoder, campaignID string, res *batchResult) error {
	if err := expectDelim(dec, '['); err != nil {
		return err
	}

	batch := make([]Message, 0, flushSize)
	flush := func() error {
		if len(batch) == 0 {
			return nil
		}
		if err := h.pub.PublishBatch(ctx, campaignID, batch); err != nil {
			return fmt.Errorf("publish: %w", err)
		}
		res.Accepted += len(batch)
		batch = batch[:0]
		return nil
	}

	for dec.More() {
		if err := ctx.Err(); err != nil {
			return err
		}
		var m Message
		if err := dec.Decode(&m); err != nil {
			return wrap(err)
		}
		if !strings.Contains(m.Recipient, "@") && !strings.HasPrefix(m.Recipient, "+") {
			res.Rejected++
			continue
		}
		batch = append(batch, m)
		if len(batch) == flushSize {
			if err := flush(); err != nil {
				return err
			}
		}
	}
	if err := flush(); err != nil {
		return err
	}
	return expectDelim(dec, ']')
}

func expectDelim(dec *json.Decoder, want json.Delim) error {
	tok, err := dec.Token()
	if err != nil {
		return wrap(err)
	}
	if d, ok := tok.(json.Delim); !ok || d != want {
		return fmt.Errorf("%w: expected %q, got %v", errMalformed, want, tok)
	}
	return nil
}

func wrap(err error) error {
	var tooBig *http.MaxBytesError
	if errors.As(err, &tooBig) || errors.Is(err, context.Canceled) {
		return err
	}
	if errors.Is(err, io.EOF) || errors.Is(err, io.ErrUnexpectedEOF) {
		return fmt.Errorf("%w: truncated body", errMalformed)
	}
	return fmt.Errorf("%w: %v", errMalformed, err)
}

func (h *BatchHandler) reply(w http.ResponseWriter, status int, res batchResult) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(res)
}
