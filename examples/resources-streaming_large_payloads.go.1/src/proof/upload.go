package proof

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"log/slog"
	"net/http"
)

const (
	maxPhotoBytes  = 25 << 20
	multipartSlack = 4 << 10
	sniffLen       = 512
)

type ObjectStore interface {
	Put(ctx context.Context, key string, body io.Reader, contentType string) (int64, error)
	Get(ctx context.Context, key string) (io.ReadCloser, string, error)
	Delete(ctx context.Context, key string) error
}

type OrderRepo interface {
	AttachProof(ctx context.Context, orderID, key, sha256Hex string, size int64) error
	ProofKey(ctx context.Context, orderID string) (string, error)
}

type UploadHandler struct {
	store  ObjectStore
	orders OrderRepo
	log    *slog.Logger
}

func NewUploadHandler(store ObjectStore, orders OrderRepo, log *slog.Logger) *UploadHandler {
	return &UploadHandler{store: store, orders: orders, log: log}
}

func (h *UploadHandler) Upload(w http.ResponseWriter, r *http.Request) {
	orderID := r.PathValue("orderID")
	r.Body = http.MaxBytesReader(w, r.Body, maxPhotoBytes+multipartSlack)

	mr, err := r.MultipartReader()
	if err != nil {
		http.Error(w, "multipart body required", http.StatusBadRequest)
		return
	}

	for {
		part, err := mr.NextPart()
		if errors.Is(err, io.EOF) {
			http.Error(w, "missing photo part", http.StatusBadRequest)
			return
		}
		if err != nil {
			h.fail(w, err)
			return
		}
		if part.FormName() != "photo" {
			continue
		}
		h.storePhoto(w, r, orderID, part)
		return
	}
}

func (h *UploadHandler) storePhoto(w http.ResponseWriter, r *http.Request, orderID string, part io.Reader) {
	head := make([]byte, sniffLen)
	n, err := io.ReadFull(part, head)
	if err != nil && !errors.Is(err, io.ErrUnexpectedEOF) {
		http.Error(w, "empty photo", http.StatusBadRequest)
		return
	}
	contentType := http.DetectContentType(head[:n])
	if contentType != "image/jpeg" && contentType != "image/png" {
		http.Error(w, "photo must be JPEG or PNG", http.StatusUnsupportedMediaType)
		return
	}

	key := fmt.Sprintf("proof/%s/%d", orderID, r.Context().Value(requestSeqKey{}))
	hasher := sha256.New()

	size, err := h.store.Put(r.Context(), key, io.TeeReader(part, hasher), contentType)
	if err != nil {
		cleanup := context.WithoutCancel(r.Context())
		if delErr := h.store.Delete(cleanup, key); delErr != nil {
			h.log.Warn("delete partial proof", "key", key, "err", delErr)
		}
		h.fail(w, err)
		return
	}

	sum := hex.EncodeToString(hasher.Sum(nil))
	if err := h.orders.AttachProof(r.Context(), orderID, key, sum, size); err != nil {
		h.log.Error("attach proof", "order", orderID, "err", err)
		http.Error(w, "could not record proof", http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusCreated)
}

func (h *UploadHandler) fail(w http.ResponseWriter, err error) {
	var tooBig *http.MaxBytesError
	if errors.As(err, &tooBig) {
		http.Error(w, "photo too large", http.StatusRequestEntityTooLarge)
		return
	}
	h.log.Error("proof upload", "err", err)
	http.Error(w, "upload failed", http.StatusBadGateway)
}

type requestSeqKey struct{}

func (h *UploadHandler) Download(w http.ResponseWriter, r *http.Request) {
	key, err := h.orders.ProofKey(r.Context(), r.PathValue("orderID"))
	if err != nil {
		http.NotFound(w, r)
		return
	}
	body, contentType, err := h.store.Get(r.Context(), key)
	if err != nil {
		h.log.Error("fetch proof", "key", key, "err", err)
		http.Error(w, "proof unavailable", http.StatusBadGateway)
		return
	}
	defer body.Close()

	w.Header().Set("Content-Type", contentType)
	if _, err := io.Copy(w, body); err != nil {
		h.log.Warn("stream proof", "key", key, "err", err)
	}
}
