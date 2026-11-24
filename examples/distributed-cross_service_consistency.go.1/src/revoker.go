package identity

import (
	"context"
	"database/sql"
	"encoding/json"
	"fmt"
)

// SessionRevoker runs in the session service and consumes deactivation events.
type SessionRevoker struct {
	db *sql.DB
}

func NewSessionRevoker(db *sql.DB) *SessionRevoker {
	return &SessionRevoker{db: db}
}

func (c *SessionRevoker) Handle(ctx context.Context, msg Message) error {
	var ev UserDeactivated
	if err := json.Unmarshal(msg.Payload, &ev); err != nil {
		return fmt.Errorf("decode %s: %w", msg.ID, err)
	}

	tx, err := c.db.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	res, err := tx.ExecContext(ctx,
		`INSERT INTO processed_events (event_id) VALUES ($1) ON CONFLICT DO NOTHING`, msg.ID)
	if err != nil {
		return fmt.Errorf("record event: %w", err)
	}
	if n, _ := res.RowsAffected(); n == 0 {
		return tx.Commit()
	}

	if _, err := tx.ExecContext(ctx, `DELETE FROM sessions WHERE user_id = $1`, ev.UserID); err != nil {
		return fmt.Errorf("revoke sessions: %w", err)
	}
	return tx.Commit()
}
