package secrets

import (
	"bytes"
	"errors"
	"fmt"
	"io"
	"io/fs"
	"os"
)

const maxSecretSize = 64 << 10

var ErrInsecurePermissions = errors.New("secret file is accessible by group or others")

// FromEnv resolves a secret named by NAME_FILE (a mounted file) and falls back to NAME.
func FromEnv(name string) (Secret, error) {
	if path := os.Getenv(name + "_FILE"); path != "" {
		return FromFile(path)
	}
	if v := os.Getenv(name); v != "" {
		return NewSecret([]byte(v)), nil
	}
	return Secret{}, fmt.Errorf("secret %s is not configured", name)
}

func FromFile(path string) (Secret, error) {
	f, err := os.Open(path)
	if err != nil {
		return Secret{}, fmt.Errorf("open secret file: %w", pathless(err))
	}
	defer f.Close()

	info, err := f.Stat()
	if err != nil {
		return Secret{}, fmt.Errorf("stat secret file: %w", pathless(err))
	}
	if info.Mode().Perm()&0o077 != 0 {
		return Secret{}, fmt.Errorf("%w: mode %o", ErrInsecurePermissions, info.Mode().Perm())
	}

	buf, err := io.ReadAll(io.LimitReader(f, maxSecretSize))
	if err != nil {
		return Secret{}, fmt.Errorf("read secret file: %w", pathless(err))
	}
	trimmed := bytes.TrimRight(buf, "\r\n")
	s := NewSecret(trimmed)
	for i := range buf {
		buf[i] = 0
	}
	if s.IsZero() {
		return Secret{}, errors.New("secret file is empty")
	}
	return s, nil
}

func pathless(err error) error {
	var pe *fs.PathError
	if errors.As(err, &pe) {
		return pe.Err
	}
	return err
}
