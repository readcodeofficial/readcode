package permissions

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
)

type Grant struct {
	Resource string
	Action   string
}

type Set struct {
	UserID string
	Grants []Grant
}

var ErrUserNotFound = errors.New("permissions: user not found")

type Store interface {
	LoadPermissions(ctx context.Context, userID string) (*Set, error)
}

type SQLStore struct {
	db *sql.DB
}

func NewSQLStore(db *sql.DB) *SQLStore {
	return &SQLStore{db: db}
}

func (s *SQLStore) LoadPermissions(ctx context.Context, userID string) (*Set, error) {
	rows, err := s.db.QueryContext(ctx,
		`SELECT resource, action FROM role_grants g
		   JOIN user_roles r ON r.role_id = g.role_id
		  WHERE r.user_id = $1`, userID)
	if err != nil {
		return nil, fmt.Errorf("load grants for %s: %w", userID, err)
	}
	defer rows.Close()

	set := &Set{UserID: userID}
	for rows.Next() {
		var g Grant
		if err := rows.Scan(&g.Resource, &g.Action); err != nil {
			return nil, fmt.Errorf("scan grant: %w", err)
		}
		set.Grants = append(set.Grants, g)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	if len(set.Grants) == 0 {
		return nil, ErrUserNotFound
	}
	return set, nil
}
