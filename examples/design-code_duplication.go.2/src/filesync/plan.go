package filesync

import (
	"context"
	"io"
	"time"
)

type FileMeta struct {
	Path    string
	Size    int64
	SHA256  string
	ModTime time.Time
}

// Remote is the cloud side of the sync (object storage in production).
type Remote interface {
	List(ctx context.Context) ([]FileMeta, error)
	Upload(ctx context.Context, meta FileMeta, body io.Reader) error
	Download(ctx context.Context, path string) (io.ReadCloser, error)
	Delete(ctx context.Context, path string) error
}

// Plan is the set of changes to apply. Delete is filled in by the caller, for
// example from tombstones reported by the remote.
type Plan struct {
	Upload   []FileMeta
	Download []FileMeta
	Delete   []string
}

// Diff compares local and remote listings. A file changed on both sides
// (different hash) goes to whichever side has the newer ModTime.
func Diff(local, remote []FileMeta) Plan {
	remoteByPath := make(map[string]FileMeta, len(remote))
	for _, m := range remote {
		remoteByPath[m.Path] = m
	}
	var plan Plan
	seen := make(map[string]bool, len(local))
	for _, l := range local {
		seen[l.Path] = true
		r, ok := remoteByPath[l.Path]
		switch {
		case !ok:
			plan.Upload = append(plan.Upload, l)
		case r.SHA256 == l.SHA256:
		case l.ModTime.After(r.ModTime):
			plan.Upload = append(plan.Upload, l)
		default:
			plan.Download = append(plan.Download, r)
		}
	}
	for _, r := range remote {
		if !seen[r.Path] {
			plan.Download = append(plan.Download, r)
		}
	}
	return plan
}
