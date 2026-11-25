package com.arena.results;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import java.util.List;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.testcontainers.containers.PostgreSQLContainer;
import org.testcontainers.junit.jupiter.Container;
import org.testcontainers.junit.jupiter.Testcontainers;

@SpringBootTest
@Testcontainers
class MatchResultServiceIT {

    @Container
    static final PostgreSQLContainer<?> POSTGRES = new PostgreSQLContainer<>("postgres:16-alpine");

    @DynamicPropertySource
    static void datasource(DynamicPropertyRegistry registry) {
        registry.add("spring.datasource.url", POSTGRES::getJdbcUrl);
        registry.add("spring.datasource.username", POSTGRES::getUsername);
        registry.add("spring.datasource.password", POSTGRES::getPassword);
        registry.add("spring.flyway.enabled", () -> "false");
        registry.add("spring.jpa.hibernate.ddl-auto", () -> "create-drop");
    }

    @Autowired
    MatchResultService service;

    @Autowired
    MatchResultRepository repository;

    @BeforeEach
    void clean() {
        repository.deleteAll();
    }

    @Test
    void recordsAResultForAPlayer() {
        MatchResult saved = service.record("m-1", "alice", 120);

        assertThat(saved.getId()).isNotNull();
        assertThat(repository.count()).isEqualTo(1);
    }

    @Test
    void rejectsASecondResultForTheSamePlayerInAMatch() {
        service.record("m-2", "alice", 50);

        assertThatThrownBy(() -> service.record("m-2", "alice", 70))
                .isInstanceOf(MatchResultService.DuplicateResultException.class);
        assertThat(repository.count()).isEqualTo(1);
    }

    @Test
    void leaderboardSumsScoresAndSharesRankOnTies() {
        service.record("m-3", "alice", 100);
        service.record("m-4", "alice", 200);
        service.record("m-3", "bob", 300);
        service.record("m-3", "carol", 100);

        List<MatchResultRepository.LeaderboardRow> rows = service.topPlayers(10);

        assertThat(rows).extracting(MatchResultRepository.LeaderboardRow::getPlayerId)
                .containsExactly("alice", "bob", "carol");
        assertThat(rows).extracting(MatchResultRepository.LeaderboardRow::getStanding)
                .containsExactly(1L, 1L, 3L);
    }
}
