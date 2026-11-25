package com.syncbox.files;

import java.util.List;
import java.util.NoSuchElementException;
import java.util.UUID;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PatchMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.bind.annotation.RestController;

record FileResponse(UUID id, UUID parentId, String name, long sizeBytes, long revision) {
    static FileResponse from(FileNode n) {
        return new FileResponse(n.getId(), n.getParentId(), n.getName(), n.getSizeBytes(), n.getRevision());
    }
}

record CreateFileRequest(UUID parentId, String name, long sizeBytes) {}

record MoveRequest(UUID newParentId) {}

@RestController
@RequestMapping("/api/files")
class FileController {

    private final FileService files;
    private final FileNodeRepository nodes;

    FileController(FileService files, FileNodeRepository nodes) {
        this.files = files;
        this.nodes = nodes;
    }

    @GetMapping
    List<FileResponse> list(@RequestHeader("X-Owner-Id") UUID ownerId,
                            @RequestParam(required = false) UUID parentId) {
        return files.list(ownerId, parentId).stream().map(FileResponse::from).toList();
    }

    @PostMapping
    ResponseEntity<FileResponse> create(@RequestHeader("X-Owner-Id") UUID ownerId,
                                        @RequestBody CreateFileRequest request) {
        FileNode created = files.createFile(ownerId, request.parentId(), request.name(), request.sizeBytes());
        return ResponseEntity.status(HttpStatus.CREATED).body(FileResponse.from(created));
    }

    @PatchMapping("/{id}/parent")
    FileResponse move(@RequestHeader("X-Owner-Id") UUID ownerId,
                      @PathVariable UUID id,
                      @RequestBody MoveRequest request) {
        return FileResponse.from(files.move(ownerId, id, request.newParentId()));
    }

    @PatchMapping("/{id}/name")
    FileResponse rename(@RequestHeader("X-Owner-Id") UUID ownerId,
                        @PathVariable UUID id,
                        @RequestBody String newName) {
        FileNode node = nodes.findByIdAndOwnerId(id, ownerId)
                .orElseThrow(() -> new NoSuchElementException("node " + id));
        node.rename(newName.trim());
        nodes.save(node);
        return FileResponse.from(node);
    }
}

@RestControllerAdvice
class FileErrorHandler {

    @ExceptionHandler(QuotaExceededException.class)
    ResponseEntity<String> quota(QuotaExceededException e) {
        return ResponseEntity.status(HttpStatus.INSUFFICIENT_STORAGE).body(e.getMessage());
    }

    @ExceptionHandler(InvalidMoveException.class)
    ResponseEntity<String> invalidMove(InvalidMoveException e) {
        return ResponseEntity.status(HttpStatus.CONFLICT).body(e.getMessage());
    }

    @ExceptionHandler(NoSuchElementException.class)
    ResponseEntity<String> missing(NoSuchElementException e) {
        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(e.getMessage());
    }
}
