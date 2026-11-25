package com.arena.results;

import java.util.List;

import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;

@Service
public class MatchResultService {

    public static class DuplicateResultException extends RuntimeException {
        public DuplicateResultException(String matchId, String playerId) {
            super("result already recorded for player " + playerId + " in match " + matchId);
        }
    }

    private final MatchResultRepository repository;

    public MatchResultService(MatchResultRepository repository) {
        this.repository = repository;
    }

    public MatchResult record(String matchId, String playerId, int score) {
        if (score < 0) {
            throw new IllegalArgumentException("score must not be negative");
        }
        try {
            return repository.saveAndFlush(new MatchResult(matchId, playerId, score));
        } catch (DataIntegrityViolationException ex) {
            throw new DuplicateResultException(matchId, playerId);
        }
    }

    public List<MatchResultRepository.LeaderboardRow> topPlayers(int limit) {
        return repository.leaderboard(Math.min(limit, 100));
    }
}
