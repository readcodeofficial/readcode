package secrets

import (
	"encoding/json"
	"fmt"
	"log/slog"
)

// Secret holds sensitive bytes and refuses to print itself.
type Secret struct {
	value []byte
}

func NewSecret(b []byte) Secret {
	cp := make([]byte, len(b))
	copy(cp, b)
	return Secret{value: cp}
}

func (s Secret) Reveal() []byte { return s.value }

func (s Secret) IsZero() bool { return len(s.value) == 0 }

func (s Secret) String() string { return "[redacted]" }

func (s Secret) GoString() string { return "secrets.Secret{[redacted]}" }

func (s Secret) Format(f fmt.State, _ rune) { _, _ = f.Write([]byte("[redacted]")) }

func (s Secret) MarshalJSON() ([]byte, error) { return json.Marshal("[redacted]") }

func (s Secret) MarshalText() ([]byte, error) { return []byte("[redacted]"), nil }

func (s Secret) LogValue() slog.Value { return slog.StringValue("[redacted]") }

func (s *Secret) Wipe() {
	for i := range s.value {
		s.value[i] = 0
	}
	s.value = nil
}
