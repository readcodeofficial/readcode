package com.syncbox.files;

import java.util.NoSuchElementException;
import java.util.UUID;
import org.springframework.context.ApplicationEventPublisher;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
public class FileService {

    private static final long QUOTA_BYTES = 15L * 1024 * 1024 * 1024;

    private final FileNodeRepository repository;
    private final ApplicationEventPublisher events;

    public FileService(FileNodeRepository repository, ApplicationEventPublisher events) {
        this.repository = repository;
        this.events = events;
    }

    @Transactional
    public FileNode createFile(UUID ownerId, UUID parentId, String name, long sizeBytes) {
        if (repository.totalBytesOwnedBy(ownerId) + sizeBytes > QUOTA_BYTES) {
            throw new QuotaExceededException("quota exceeded for owner " + ownerId);
        }
        FileNode node = repository.save(new FileNode(ownerId, parentId, name, sizeBytes));
        events.publishEvent(new FileChanged(ownerId, node.getId(), node.getRevision()));
        return node;
    }

    @Transactional
    public FileNode move(UUID ownerId, UUID nodeId, UUID newParentId) {
        FileNode node = repository.findByIdAndOwnerId(nodeId, ownerId)
                .orElseThrow(() -> new NoSuchElementException("node " + nodeId));
        if (newParentId != null) {
            assertNotDescendant(ownerId, nodeId, newParentId);
        }
        node.setParentId(newParentId);
        node.bumpRevision();
        events.publishEvent(new FileChanged(ownerId, node.getId(), node.getRevision()));
        return node;
    }

    @Transactional(readOnly = true)
    public java.util.List<FileNode> list(UUID ownerId, UUID parentId) {
        return repository.findByOwnerIdAndParentId(ownerId, parentId);
    }

    private void assertNotDescendant(UUID ownerId, UUID nodeId, UUID candidateParentId) {
        UUID cursor = candidateParentId;
        while (cursor != null) {
            if (cursor.equals(nodeId)) {
                throw new InvalidMoveException("cannot move a folder into itself");
            }
            cursor = repository.findByIdAndOwnerId(cursor, ownerId)
                    .map(FileNode::getParentId)
                    .orElseThrow(() -> new NoSuchElementException("parent folder missing"));
        }
    }
}
