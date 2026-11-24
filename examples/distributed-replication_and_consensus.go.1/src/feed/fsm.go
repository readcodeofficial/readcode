package feed

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"sort"
	"sync"
	"time"

	"github.com/hashicorp/raft"
)

var (
	ErrDuplicatePost = errors.New("feed: post already exists")
	ErrPostNotFound  = errors.New("feed: post not found")
)

type Post struct {
	ID        string    `json:"id"`
	Author    string    `json:"author"`
	Body      string    `json:"body"`
	CreatedAt time.Time `json:"created_at"`
}

type command struct {
	Op   string `json:"op"`
	Post Post   `json:"post"`
}

type FSM struct {
	mu    sync.RWMutex
	posts map[string]Post
}

func NewFSM() *FSM {
	return &FSM{posts: make(map[string]Post)}
}

// Apply runs on every replica, in log order, once an entry is committed.
func (f *FSM) Apply(l *raft.Log) interface{} {
	var cmd command
	if err := json.Unmarshal(l.Data, &cmd); err != nil {
		return fmt.Errorf("decode command at index %d: %w", l.Index, err)
	}

	f.mu.Lock()
	defer f.mu.Unlock()
	switch cmd.Op {
	case "publish":
		if _, exists := f.posts[cmd.Post.ID]; exists {
			return ErrDuplicatePost
		}
		f.posts[cmd.Post.ID] = cmd.Post
	case "delete":
		if _, exists := f.posts[cmd.Post.ID]; !exists {
			return ErrPostNotFound
		}
		delete(f.posts, cmd.Post.ID)
	default:
		return fmt.Errorf("unknown op %q", cmd.Op)
	}
	return nil
}

func (f *FSM) Snapshot() (raft.FSMSnapshot, error) {
	f.mu.RLock()
	defer f.mu.RUnlock()
	copied := make(map[string]Post, len(f.posts))
	for id, p := range f.posts {
		copied[id] = p
	}
	return &snapshot{posts: copied}, nil
}

func (f *FSM) Restore(rc io.ReadCloser) error {
	defer rc.Close()
	posts := make(map[string]Post)
	if err := json.NewDecoder(rc).Decode(&posts); err != nil {
		return fmt.Errorf("restore snapshot: %w", err)
	}
	f.mu.Lock()
	f.posts = posts
	f.mu.Unlock()
	return nil
}

func (f *FSM) latestBy(author string, limit int) []Post {
	f.mu.RLock()
	defer f.mu.RUnlock()
	var out []Post
	for _, p := range f.posts {
		if p.Author == author {
			out = append(out, p)
		}
	}
	sort.Slice(out, func(i, j int) bool { return out[i].CreatedAt.After(out[j].CreatedAt) })
	if len(out) > limit {
		out = out[:limit]
	}
	return out
}

type snapshot struct {
	posts map[string]Post
}

func (s *snapshot) Persist(sink raft.SnapshotSink) error {
	if err := json.NewEncoder(sink).Encode(s.posts); err != nil {
		_ = sink.Cancel()
		return err
	}
	return sink.Close()
}

func (s *snapshot) Release() {}
