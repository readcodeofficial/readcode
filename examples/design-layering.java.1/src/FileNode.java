package com.syncbox.files;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;
import jakarta.persistence.UniqueConstraint;
import java.util.List;
import java.util.Optional;
import java.util.UUID;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

@Entity
@Table(name = "file_nodes",
        uniqueConstraints = @UniqueConstraint(columnNames = {"owner_id", "parent_id", "name"}))
public class FileNode {

    @Id
    @GeneratedValue
    private UUID id;

    @Column(name = "owner_id", nullable = false)
    private UUID ownerId;

    @Column(name = "parent_id")
    private UUID parentId;

    @Column(nullable = false)
    private String name;

    @Column(name = "size_bytes", nullable = false)
    private long sizeBytes;

    @Column(nullable = false)
    private long revision;

    protected FileNode() {}

    public FileNode(UUID ownerId, UUID parentId, String name, long sizeBytes) {
        this.ownerId = ownerId;
        this.parentId = parentId;
        this.name = name;
        this.sizeBytes = sizeBytes;
        this.revision = 1;
    }

    public UUID getId() { return id; }
    public UUID getOwnerId() { return ownerId; }
    public UUID getParentId() { return parentId; }
    public String getName() { return name; }
    public long getSizeBytes() { return sizeBytes; }
    public long getRevision() { return revision; }

    public void setParentId(UUID parentId) { this.parentId = parentId; }
    public void rename(String newName) { this.name = newName; }
    public void bumpRevision() { this.revision++; }
}

interface FileNodeRepository extends JpaRepository<FileNode, UUID> {

    List<FileNode> findByOwnerIdAndParentId(UUID ownerId, UUID parentId);

    Optional<FileNode> findByIdAndOwnerId(UUID id, UUID ownerId);

    @Query("select coalesce(sum(f.sizeBytes), 0) from FileNode f where f.ownerId = :ownerId")
    long totalBytesOwnedBy(UUID ownerId);
}

record FileChanged(UUID ownerId, UUID nodeId, long revision) {}

class QuotaExceededException extends RuntimeException {
    QuotaExceededException(String message) { super(message); }
}

class InvalidMoveException extends RuntimeException {
    InvalidMoveException(String message) { super(message); }
}
