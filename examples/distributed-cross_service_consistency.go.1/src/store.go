package identity

import (
	"context"
	"crypto/rand"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"time"
)

var ErrNotActive = errors.New("identity: user is not active")

const TopicUserDeactivated = "identity.user.deactivated"

type UserDeactivated struct {
	UserID string    `json:"user_id"`
	Reason string    `json:"reason"`
	At     time.Time `json:"at"`
}

type Store struct {
	db *sql.DB
}

func NewStore(db *sql.DB) *Store {
	return &Store{db: db}
}

func newID() string {
	b := make([]byte, 16)
	if _, err := rand.Read(b); err != nil {
		panic(err)
	}
	return hex.EncodeToString(b)
}

// DeactivateUser disables the account and records the event that tells other
// services (sessions, API gateway, audit) to react.
func (s *Store) DeactivateUser(ctx context.Context, userID, reason string) error {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("begin: %w", err)
	}
	defer tx.Rollback()

	res, err := tx.ExecContext(ctx,
		`UPDATE users SET status = 'deactivated', deactivated_at = now()
		 WHERE id = $1 AND status = 'active'`, userID)
	if err != nil {
		return fmt.Errorf("update user: %w", err)
	}
	if n, err := res.RowsAffected(); err != nil {
		return fmt.Errorf("rows affected: %w", err)
	} else if n == 0 {
		return ErrNotActive
	}

	payload, err := json.Marshal(UserDeactivated{UserID: userID, Reason: reason, At: time.Now().UTC()})
	if err != nil {
		return fmt.Errorf("marshal event: %w", err)
	}
	_, err = tx.ExecContext(ctx,
		`INSERT INTO outbox (id, topic, key, payload, created_at)
		 VALUES ($1, $2, $3, $4, now())`,
		newID(), TopicUserDeactivated, userID, payload)
	if err != nil {
		return fmt.Errorf("insert outbox: %w", err)
	}

	if err := tx.Commit(); err != nil {
		return fmt.Errorf("commit: %w", err)
	}
	return nil
}
