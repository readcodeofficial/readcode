package com.acme.sync;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;

import com.acme.sync.ChunkPlanner.Chunk;
import java.util.List;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;
import org.junit.jupiter.params.provider.ValueSource;

class ChunkPlannerTest {

    private final ChunkPlanner planner = new ChunkPlanner(4);

    @ParameterizedTest(name = "size {0} gives {1} chunks, last one {2} bytes")
    @CsvSource({"1,1,1", "3,1,3", "4,1,4", "5,2,1", "8,2,4", "9,3,1"})
    void splitsAroundChunkBoundaries(long size, int expectedCount, long expectedLastLength) {
        List<Chunk> chunks = planner.plan(size);

        assertEquals(expectedCount, chunks.size());
        assertEquals(expectedLastLength, chunks.get(chunks.size() - 1).length());
    }

    @Test
    void emptyFileNeedsNoChunks() {
        assertTrue(planner.plan(0).isEmpty());
    }

    @Test
    void negativeSizeIsRejected() {
        assertThrows(IllegalArgumentException.class, () -> planner.plan(-1));
    }

    @ParameterizedTest(name = "size {0}")
    @ValueSource(longs = {1, 4, 5, 17, 1024})
    void chunksAreContiguousAndCoverTheFile(long size) {
        List<Chunk> chunks = planner.plan(size);

        long expectedOffset = 0;
        for (Chunk chunk : chunks) {
            assertEquals(expectedOffset, chunk.offset());
            expectedOffset += chunk.length();
        }
        assertEquals(planner.totalLength(chunks), expectedOffset);
    }
}
