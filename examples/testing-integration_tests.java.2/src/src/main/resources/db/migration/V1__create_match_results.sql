CREATE TABLE match_results (
    id          BIGSERIAL PRIMARY KEY,
    match_id    VARCHAR(64) NOT NULL,
    player_id   VARCHAR(64) NOT NULL,
    score       INTEGER     NOT NULL CHECK (score >= 0),
    recorded_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_match_results_player ON match_results (player_id);
