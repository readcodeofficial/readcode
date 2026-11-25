package authsvc

import (
	"context"
	"encoding/json"
	"errors"
	"log/slog"
	"net/http"
	"time"
)

type LoginRequest struct {
	Email    string `json:"email"`
	Password string `json:"password"`
}

func (r LoginRequest) LogValue() slog.Value {
	return slog.GroupValue(slog.String("email", r.Email))
}

type ResetConfirmRequest struct {
	ResetToken  string `json:"reset_token"`
	NewPassword string `json:"new_password"`
}

type Credentials interface {
	Verify(ctx context.Context, email, password string) (userID string, err error)
	ConfirmReset(ctx context.Context, resetToken, newPassword string) (userID string, err error)
}

var (
	ErrBadCredentials = errors.New("invalid credentials")
	ErrBadResetToken  = errors.New("invalid or expired reset token")
)

type Handlers struct {
	log   *slog.Logger
	creds Credentials
}

func NewHandlers(log *slog.Logger, creds Credentials) *Handlers {
	return &Handlers{log: log, creds: creds}
}

func (h *Handlers) Routes() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("POST /login", h.login)
	mux.HandleFunc("POST /password-reset/confirm", h.confirmReset)
	return h.requestLog(mux)
}

func (h *Handlers) requestLog(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		next.ServeHTTP(w, r)
		h.log.InfoContext(r.Context(), "request handled",
			slog.String("method", r.Method),
			slog.String("path", r.URL.Path),
			slog.Duration("elapsed", time.Since(start)),
			slog.Group("headers",
				slog.String("Authorization", r.Header.Get("Authorization")),
				slog.String("User-Agent", r.UserAgent()),
			),
		)
	})
}

func (h *Handlers) login(w http.ResponseWriter, r *http.Request) {
	var req LoginRequest
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 1<<16)).Decode(&req); err != nil {
		http.Error(w, "bad request", http.StatusBadRequest)
		return
	}
	h.log.DebugContext(r.Context(), "login attempt", slog.Any("request", req))

	userID, err := h.creds.Verify(r.Context(), req.Email, req.Password)
	if errors.Is(err, ErrBadCredentials) {
		h.log.WarnContext(r.Context(), "login rejected", slog.String("email", req.Email))
		http.Error(w, "invalid credentials", http.StatusUnauthorized)
		return
	}
	if err != nil {
		h.log.ErrorContext(r.Context(), "login failed", slog.String("email", req.Email), slog.Any("error", err))
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	h.log.InfoContext(r.Context(), "login succeeded", slog.String("user_id", userID))
	w.WriteHeader(http.StatusNoContent)
}

func (h *Handlers) confirmReset(w http.ResponseWriter, r *http.Request) {
	var req ResetConfirmRequest
	if err := json.NewDecoder(http.MaxBytesReader(w, r.Body, 1<<16)).Decode(&req); err != nil {
		http.Error(w, "bad request", http.StatusBadRequest)
		return
	}
	h.log.DebugContext(r.Context(), "password reset confirmation", slog.Any("request", req))

	userID, err := h.creds.ConfirmReset(r.Context(), req.ResetToken, req.NewPassword)
	if errors.Is(err, ErrBadResetToken) {
		http.Error(w, "invalid or expired reset token", http.StatusBadRequest)
		return
	}
	if err != nil {
		h.log.ErrorContext(r.Context(), "password reset failed", slog.Any("error", err))
		http.Error(w, "internal error", http.StatusInternalServerError)
		return
	}
	h.log.InfoContext(r.Context(), "password reset completed", slog.String("user_id", userID))
	w.WriteHeader(http.StatusNoContent)
}
