package ingest

import (
	"bufio"
	"errors"
	"fmt"
	"io"
	"strings"
)

var ErrBadHeader = errors.New("malformed statement header")

// Header is the first line of a statement file: "ACCOUNT,CCY".
type Header struct {
	Account  string
	Currency string
}

func ReadHeader(br *bufio.Reader) (Header, error) {
	line, err := br.ReadString('\n')
	if err != nil && err != io.EOF {
		return Header{}, fmt.Errorf("read header: %w", err)
	}
	parts := strings.Split(strings.TrimSpace(line), ",")
	if len(parts) != 2 || parts[0] == "" || len(parts[1]) != 3 {
		return Header{}, ErrBadHeader
	}
	return Header{Account: parts[0], Currency: parts[1]}, nil
}
