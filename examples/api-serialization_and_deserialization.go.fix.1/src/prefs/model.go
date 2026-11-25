package prefs

import "sync"

// Preferences are the notification settings stored per user.
type Preferences struct {
	DisplayName string `json:"displayName"`
	EmailAlerts bool   `json:"emailAlerts"`
	DigestHour  int    `json:"digestHour"`
}

// Defaults are what a user has before changing anything.
func Defaults() Preferences {
	return Preferences{DisplayName: "", EmailAlerts: true, DigestHour: 8}
}

// MemoryStore keeps preferences in memory.
type MemoryStore struct {
	mu    sync.Mutex
	users map[string]Preferences
}

func NewMemoryStore() *MemoryStore {
	return &MemoryStore{users: make(map[string]Preferences)}
}

func (s *MemoryStore) Get(userID string) Preferences {
	s.mu.Lock()
	defer s.mu.Unlock()
	if p, ok := s.users[userID]; ok {
		return p
	}
	return Defaults()
}

func (s *MemoryStore) Put(userID string, p Preferences) {
	s.mu.Lock()
	s.users[userID] = p
	s.mu.Unlock()
}
