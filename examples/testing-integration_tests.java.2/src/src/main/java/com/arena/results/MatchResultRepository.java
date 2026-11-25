package com.arena.results;

import java.util.List;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

public interface MatchResultRepository extends JpaRepository<MatchResult, Long> {

    interface LeaderboardRow {
        String getPlayerId();

        long getTotalScore();

        long getStanding();
    }

    @Query(value = """
            SELECT player_id AS playerId,
                   SUM(score) AS totalScore,
                   RANK() OVER (ORDER BY SUM(score) DESC) AS standing
            FROM match_results
            GROUP BY player_id
            ORDER BY totalScore DESC, player_id
            LIMIT :limit
            """, nativeQuery = true)
    List<LeaderboardRow> leaderboard(@Param("limit") int limit);
}
