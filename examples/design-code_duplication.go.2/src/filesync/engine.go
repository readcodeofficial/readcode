package filesync

import (
	"context"
	"crypto/sha256"
	"encoding/hex"
	"errors"
	"fmt"
	"io"
	"os"
	"path/filepath"
)

type Engine struct {
	Root        string
	Remote      Remote
	Concurrency int
}

func (e *Engine) Apply(ctx context.Context, plan Plan) error {
	push := runBatch(ctx, e.Concurrency, plan.Upload,
		func(m FileMeta) string { return "upload " + m.Path }, e.upload)
	pull := runBatch(ctx, e.Concurrency, plan.Download,
		func(m FileMeta) string { return "download " + m.Path }, e.download)
	remove := runBatch(ctx, e.Concurrency, plan.Delete,
		func(p string) string { return "delete " + p },
		func(ctx context.Context, p string) error { return e.Remote.Delete(ctx, p) })
	return errors.Join(push, pull, remove)
}

func (e *Engine) upload(ctx context.Context, meta FileMeta) error {
	f, err := os.Open(filepath.Join(e.Root, filepath.FromSlash(meta.Path)))
	if err != nil {
		return err
	}
	defer f.Close()
	return e.Remote.Upload(ctx, meta, f)
}

func (e *Engine) download(ctx context.Context, meta FileMeta) error {
	body, err := e.Remote.Download(ctx, meta.Path)
	if err != nil {
		return err
	}
	defer body.Close()

	dest := filepath.Join(e.Root, filepath.FromSlash(meta.Path))
	if err := os.MkdirAll(filepath.Dir(dest), 0o755); err != nil {
		return err
	}
	tmp, err := os.CreateTemp(filepath.Dir(dest), ".sync-*")
	if err != nil {
		return err
	}
	defer os.Remove(tmp.Name())

	h := sha256.New()
	if _, err := io.Copy(io.MultiWriter(tmp, h), body); err != nil {
		tmp.Close()
		return err
	}
	if err := tmp.Close(); err != nil {
		return err
	}
	if got := hex.EncodeToString(h.Sum(nil)); got != meta.SHA256 {
		return fmt.Errorf("checksum mismatch: got %s, want %s", got, meta.SHA256)
	}
	return os.Rename(tmp.Name(), dest)
}
