package ingest

import "io"

// Source opens statement files by name (a directory, an SFTP drop, ...).
type Source interface {
	Open(name string) (io.ReadCloser, error)
}
