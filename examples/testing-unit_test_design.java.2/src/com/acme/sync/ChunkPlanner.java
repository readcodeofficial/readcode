package com.acme.sync;

import java.util.ArrayList;
import java.util.List;

public final class ChunkPlanner {

    public record Chunk(int index, long offset, long length) {}

    private final long chunkSize;

    public ChunkPlanner(long chunkSize) {
        if (chunkSize <= 0) {
            throw new IllegalArgumentException("chunkSize must be positive");
        }
        this.chunkSize = chunkSize;
    }

    public List<Chunk> plan(long fileSize) {
        if (fileSize < 0) {
            throw new IllegalArgumentException("fileSize must not be negative");
        }
        List<Chunk> chunks = new ArrayList<>();
        long offset = 0;
        int index = 0;
        while (offset < fileSize) {
            long length = Math.min(chunkSize, fileSize - offset);
            chunks.add(new Chunk(index++, offset, length));
            offset += length;
        }
        return chunks;
    }

    public long totalLength(List<Chunk> chunks) {
        return chunks.stream().mapToLong(Chunk::length).sum();
    }
}
