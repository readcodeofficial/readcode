package com.arena.results;

import java.time.Instant;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.GenerationType;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;

@Entity
@Table(name = "match_results",
        uniqueConstraints = @UniqueConstraint(name = "uq_match_player", columnNames = {"match_id", "player_id"}))
public class MatchResult {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "match_id", nullable = false)
    private String matchId;

    @Column(name = "player_id", nullable = false)
    private String playerId;

    @Column(nullable = false)
    private int score;

    @Column(name = "recorded_at", nullable = false)
    private Instant recordedAt = Instant.now();

    protected MatchResult() {
    }

    public MatchResult(String matchId, String playerId, int score) {
        this.matchId = matchId;
        this.playerId = playerId;
        this.score = score;
    }

    public Long getId() { return id; }
    public String getMatchId() { return matchId; }
    public String getPlayerId() { return playerId; }
    public int getScore() { return score; }
}
