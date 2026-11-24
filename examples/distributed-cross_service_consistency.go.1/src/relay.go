package identity

import (
	"context"
	"database/sql"
	"fmt"
	"log/slog"
	"time"
)

type Message struct {
	ID      string
	Topic   string
	Key     string
	Payload []byte
}

type Publisher interface {
	Publish(ctx context.Context, msg Message) error
}

type Relay struct {
	db       *sql.DB
	pub      Publisher
	batch    int
	interval time.Duration
}

func NewRelay(db *sql.DB, pub Publisher, batch int, interval time.Duration) *Relay {
	return &Relay{db: db, pub: pub, batch: batch, interval: interval}
}

func (r *Relay) Run(ctx context.Context) error {
	ticker := time.NewTicker(r.interval)
	defer ticker.Stop()

	for {
		for {
			n, err := r.drain(ctx)
			if err != nil {
				slog.Error("outbox drain failed", "err", err)
				break
			}
			if n < r.batch {
				break
			}
		}

		select {
		case <-ctx.Done():
			return ctx.Err()
		case <-ticker.C:
		}
	}
}

func (r *Relay) drain(ctx context.Context) (int, error) {
	rows, err := r.db.QueryContext(ctx,
		`SELECT id, topic, key, payload FROM outbox
		 WHERE published_at IS NULL ORDER BY seq LIMIT $1`, r.batch)
	if err != nil {
		return 0, fmt.Errorf("select outbox: %w", err)
	}

	var pending []Message
	for rows.Next() {
		var m Message
		if err := rows.Scan(&m.ID, &m.Topic, &m.Key, &m.Payload); err != nil {
			rows.Close()
			return 0, fmt.Errorf("scan outbox: %w", err)
		}
		pending = append(pending, m)
	}
	if err := rows.Close(); err != nil {
		return 0, err
	}
	if err := rows.Err(); err != nil {
		return 0, err
	}

	sent := 0
	for _, m := range pending {
		if _, err := r.db.ExecContext(ctx,
			`UPDATE outbox SET published_at = now() WHERE id = $1`, m.ID); err != nil {
			return sent, fmt.Errorf("mark published %s: %w", m.ID, err)
		}
		if err := r.pub.Publish(ctx, m); err != nil {
			return sent, fmt.Errorf("publish %s: %w", m.ID, err)
		}
		sent++
	}
	return sent, nil
}
