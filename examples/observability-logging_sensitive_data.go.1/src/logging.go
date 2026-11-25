package authsvc

import (
	"io"
	"log/slog"
	"strings"
)

const redacted = "[REDACTED]"

var sensitiveKeys = map[string]struct{}{
	"password":      {},
	"new_password":  {},
	"token":         {},
	"reset_token":   {},
	"authorization": {},
	"cookie":        {},
	"client_secret": {},
}

func NewLogger(w io.Writer, level slog.Level, service string) *slog.Logger {
	h := slog.NewJSONHandler(w, &slog.HandlerOptions{
		Level:       level,
		ReplaceAttr: redactAttr,
	})
	return slog.New(h).With(slog.String("service", service))
}

func redactAttr(groups []string, a slog.Attr) slog.Attr {
	key := strings.ToLower(a.Key)
	if _, ok := sensitiveKeys[key]; ok {
		return slog.String(a.Key, redacted)
	}
	if key == "email" && a.Value.Kind() == slog.KindString {
		return slog.String(a.Key, maskEmail(a.Value.String()))
	}
	return a
}

func maskEmail(email string) string {
	at := strings.LastIndex(email, "@")
	if at <= 0 {
		return redacted
	}
	return email[:1] + "***" + email[at:]
}
