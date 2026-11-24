package main

import (
	"context"
	"sync"
)

type Status string

const (
	StatusQueued      Status = "queued"
	StatusRunning     Status = "running"
	StatusComplete    Status = "complete"
	StatusInterrupted Status = "interrupted"
	StatusFailed      Status = "failed"
)

type PayRun struct {
	ID        string   `json:"id"`
	Employees []string `json:"employees"`
}

type Store interface {
	SetStatus(runID string, s Status)
	SaveLine(ctx context.Context, runID, employeeID string) error
}

type MemoryStore struct {
	mu       sync.Mutex
	statuses map[string]Status
	lines    map[string][]string
}

func NewMemoryStore() *MemoryStore {
	return &MemoryStore{statuses: map[string]Status{}, lines: map[string][]string{}}
}

func (m *MemoryStore) SetStatus(runID string, s Status) {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.statuses[runID] = s
}

func (m *MemoryStore) SaveLine(ctx context.Context, runID, employeeID string) error {
	m.mu.Lock()
	defer m.mu.Unlock()
	m.lines[runID] = append(m.lines[runID], employeeID)
	return nil
}
