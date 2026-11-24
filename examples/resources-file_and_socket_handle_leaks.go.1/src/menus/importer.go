package menus

import (
	"context"
	"database/sql"
	"encoding/csv"
	"errors"
	"fmt"
	"io"
	"os"
	"strconv"
)

type Importer struct {
	db      *sql.DB
	fetcher *Fetcher
}

func NewImporter(db *sql.DB, fetcher *Fetcher) *Importer {
	return &Importer{db: db, fetcher: fetcher}
}

func (im *Importer) Sync(ctx context.Context, restaurantID string) (int, error) {
	path, err := im.fetcher.Fetch(ctx, restaurantID)
	if err != nil {
		return 0, err
	}
	defer os.Remove(path)

	f, err := os.Open(path)
	if err != nil {
		return 0, fmt.Errorf("open feed: %w", err)
	}
	defer f.Close()

	tx, err := im.db.BeginTx(ctx, nil)
	if err != nil {
		return 0, fmt.Errorf("begin import: %w", err)
	}
	defer tx.Rollback()

	if _, err := tx.ExecContext(ctx, `UPDATE menu_items SET active = false WHERE restaurant_id = $1`, restaurantID); err != nil {
		return 0, fmt.Errorf("deactivate items: %w", err)
	}

	stmt, err := tx.PrepareContext(ctx, `
		INSERT INTO menu_items (restaurant_id, sku, name, price_cents, active)
		VALUES ($1, $2, $3, $4, true)
		ON CONFLICT (restaurant_id, sku) DO UPDATE
		SET name = EXCLUDED.name, price_cents = EXCLUDED.price_cents, active = true`)
	if err != nil {
		return 0, fmt.Errorf("prepare upsert: %w", err)
	}
	defer stmt.Close()

	reader := csv.NewReader(f)
	if _, err := reader.Read(); err != nil {
		return 0, fmt.Errorf("read header: %w", err)
	}

	count := 0
	for {
		rec, err := reader.Read()
		if errors.Is(err, io.EOF) {
			break
		}
		if err != nil {
			return 0, fmt.Errorf("read row %d: %w", count+2, err)
		}
		price, err := strconv.Atoi(rec[2])
		if err != nil {
			return 0, fmt.Errorf("row %d: bad price %q: %w", count+2, rec[2], err)
		}
		if _, err := stmt.ExecContext(ctx, restaurantID, rec[0], rec[1], price); err != nil {
			return 0, fmt.Errorf("upsert row %d: %w", count+2, err)
		}
		count++
	}

	if err := tx.Commit(); err != nil {
		return 0, fmt.Errorf("commit import: %w", err)
	}
	return count, nil
}

type Item struct {
	SKU        string
	Name       string
	PriceCents int
}

func (im *Importer) ActiveItems(ctx context.Context, restaurantID string) ([]Item, error) {
	rows, err := im.db.QueryContext(ctx,
		`SELECT sku, name, price_cents FROM menu_items WHERE restaurant_id = $1 AND active ORDER BY sku`,
		restaurantID)
	if err != nil {
		return nil, fmt.Errorf("query items: %w", err)
	}
	defer rows.Close()

	var items []Item
	for rows.Next() {
		var it Item
		if err := rows.Scan(&it.SKU, &it.Name, &it.PriceCents); err != nil {
			return nil, fmt.Errorf("scan item: %w", err)
		}
		items = append(items, it)
	}
	if err := rows.Err(); err != nil {
		return nil, fmt.Errorf("iterate items: %w", err)
	}
	return items, nil
}
