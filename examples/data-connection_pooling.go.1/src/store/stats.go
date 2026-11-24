package store

import (
	"context"
	"database/sql"
	"fmt"
	"time"

	"golang.org/x/sync/errgroup"
)

type CampaignStats struct {
	CampaignID  int64
	Impressions int64
	Clicks      int64
}

type StatsStore struct {
	db *sql.DB
}

func NewStatsStore(db *sql.DB) *StatsStore {
	return &StatsStore{db: db}
}

func (s *StatsStore) ForAdvertiser(ctx context.Context, advertiserID int64, day time.Time) ([]CampaignStats, error) {
	rows, err := s.db.QueryContext(ctx,
		`SELECT campaign_id, SUM(impressions), SUM(clicks)
		   FROM hourly_campaign_stats
		  WHERE advertiser_id = $1 AND hour >= $2 AND hour < $3
		  GROUP BY campaign_id
		  ORDER BY campaign_id`,
		advertiserID, day, day.Add(24*time.Hour))
	if err != nil {
		return nil, fmt.Errorf("query stats: %w", err)
	}

	var out []CampaignStats
	for rows.Next() {
		var cs CampaignStats
		if err := rows.Scan(&cs.CampaignID, &cs.Impressions, &cs.Clicks); err != nil {
			return nil, fmt.Errorf("scan stats: %w", err)
		}
		out = append(out, cs)
	}
	if err := rows.Err(); err != nil {
		rows.Close()
		return nil, fmt.Errorf("iterate stats: %w", err)
	}
	rows.Close()
	return out, nil
}

func (s *StatsStore) ForAdvertisers(ctx context.Context, ids []int64, day time.Time) (map[int64][]CampaignStats, error) {
	var (
		g      errgroup.Group
		result = make(map[int64][]CampaignStats, len(ids))
		resCh  = make(chan struct {
			id    int64
			stats []CampaignStats
		}, len(ids))
	)
	g.SetLimit(4)
	for _, id := range ids {
		id := id
		g.Go(func() error {
			stats, err := s.ForAdvertiser(ctx, id, day)
			if err != nil {
				return err
			}
			resCh <- struct {
				id    int64
				stats []CampaignStats
			}{id, stats}
			return nil
		})
	}
	err := g.Wait()
	close(resCh)
	if err != nil {
		return nil, err
	}
	for r := range resCh {
		result[r.id] = r.stats
	}
	return result, nil
}

func (s *StatsStore) RecordBatch(ctx context.Context, batch []CampaignStats, hour time.Time) error {
	tx, err := s.db.BeginTx(ctx, nil)
	if err != nil {
		return fmt.Errorf("begin: %w", err)
	}
	defer tx.Rollback()

	stmt, err := tx.PrepareContext(ctx,
		`INSERT INTO hourly_campaign_stats (campaign_id, hour, impressions, clicks)
		 VALUES ($1, $2, $3, $4)
		 ON CONFLICT (campaign_id, hour)
		 DO UPDATE SET impressions = hourly_campaign_stats.impressions + EXCLUDED.impressions,
		               clicks = hourly_campaign_stats.clicks + EXCLUDED.clicks`)
	if err != nil {
		return fmt.Errorf("prepare: %w", err)
	}
	defer stmt.Close()

	for _, cs := range batch {
		if _, err := stmt.ExecContext(ctx, cs.CampaignID, hour, cs.Impressions, cs.Clicks); err != nil {
			return fmt.Errorf("insert campaign %d: %w", cs.CampaignID, err)
		}
	}
	return tx.Commit()
}
