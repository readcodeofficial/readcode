package ledgerapi

import (
	"bytes"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"io"
	"log/slog"
	"net/http"
	"strings"

	"example.com/ledger/secrets"
)

const maxBody = 1 << 20

type Config struct {
	DatabaseURL secrets.Secret
	SigningKey  secrets.Secret
	ListenAddr  string
}

func LoadConfig() (Config, error) {
	db, err := secrets.FromEnv("LEDGER_DATABASE_URL")
	if err != nil {
		return Config{}, err
	}
	key, err := secrets.FromEnv("LEDGER_SIGNING_KEY")
	if err != nil {
		return Config{}, err
	}
	return Config{DatabaseURL: db, SigningKey: key, ListenAddr: ":8443"}, nil
}

func RequireSignature(key secrets.Secret, log *slog.Logger, next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		got, err := hex.DecodeString(strings.TrimPrefix(r.Header.Get("X-Signature"), "sha256="))
		if err != nil || len(got) != sha256.Size {
			http.Error(w, "invalid signature", http.StatusUnauthorized)
			return
		}

		body, err := io.ReadAll(http.MaxBytesReader(w, r.Body, maxBody))
		if err != nil {
			http.Error(w, "unreadable body", http.StatusRequestEntityTooLarge)
			return
		}

		mac := hmac.New(sha256.New, key.Reveal())
		mac.Write(body)
		if !hmac.Equal(mac.Sum(nil), got) {
			log.Warn("signature mismatch", "remote", r.RemoteAddr, "path", r.URL.Path)
			http.Error(w, "invalid signature", http.StatusUnauthorized)
			return
		}

		r.Body = io.NopCloser(bytes.NewReader(body))
		next.ServeHTTP(w, r)
	})
}

func LogStartup(log *slog.Logger, cfg Config) {
	log.Info("ledger api starting", "config", cfg, "signing_key", cfg.SigningKey)
}
