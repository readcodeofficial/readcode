package feed

import (
	"encoding/json"
	"errors"
	"fmt"
	"time"

	"github.com/hashicorp/raft"
)

const applyTimeout = 5 * time.Second

type NotLeaderError struct {
	Leader raft.ServerAddress
}

func (e *NotLeaderError) Error() string {
	return fmt.Sprintf("feed: not the leader (leader is %q)", e.Leader)
}

type Service struct {
	raft *raft.Raft
	fsm  *FSM
}

func NewService(r *raft.Raft, fsm *FSM) *Service {
	return &Service{raft: r, fsm: fsm}
}

func (s *Service) Publish(p Post) error {
	if s.raft.State() != raft.Leader {
		return &NotLeaderError{Leader: s.raft.Leader()}
	}
	data, err := json.Marshal(command{Op: "publish", Post: p})
	if err != nil {
		return fmt.Errorf("encode publish: %w", err)
	}

	f := s.raft.Apply(data, applyTimeout)
	if err := f.Error(); err != nil {
		return fmt.Errorf("replicate post: %w", err)
	}
	return nil
}

func (s *Service) Delete(postID string) error {
	if s.raft.State() != raft.Leader {
		return &NotLeaderError{Leader: s.raft.Leader()}
	}
	data, err := json.Marshal(command{Op: "delete", Post: Post{ID: postID}})
	if err != nil {
		return fmt.Errorf("encode delete: %w", err)
	}

	f := s.raft.Apply(data, applyTimeout)
	if err := f.Error(); err != nil {
		return fmt.Errorf("replicate delete: %w", err)
	}
	if resp, ok := f.Response().(error); ok {
		return resp
	}
	return nil
}

// Timeline returns an author's latest posts. A strong read first confirms that this node
// is still the leader of a quorum; a stale read is served from local state on any node.
func (s *Service) Timeline(author string, limit int, strong bool) ([]Post, error) {
	if strong {
		if s.raft.State() != raft.Leader {
			return nil, &NotLeaderError{Leader: s.raft.Leader()}
		}
		if err := s.raft.VerifyLeader().Error(); err != nil {
			if errors.Is(err, raft.ErrNotLeader) || errors.Is(err, raft.ErrLeadershipLost) {
				return nil, &NotLeaderError{Leader: s.raft.Leader()}
			}
			return nil, fmt.Errorf("verify leader: %w", err)
		}
		if err := s.raft.Barrier(applyTimeout).Error(); err != nil {
			return nil, fmt.Errorf("barrier: %w", err)
		}
	}
	return s.fsm.latestBy(author, limit), nil
}
