package ingest

import (
	"bufio"
	"fmt"
	"io"
	"strings"
)

type Result struct {
	File     string
	Account  string
	Currency string
	Rows     int
	Err      error
}

type Summary struct {
	Imported int
	Failed   int
	Rows     int
}

// ImportAll reads every named statement and reports one Result per file.
// A bad file never stops the batch.
func ImportAll(src Source, names []string) []Result {
	results := make([]Result, 0, len(names))
	for _, name := range names {
		res := Result{File: name}
		rc, err := src.Open(name)
		if err != nil {
			res.Err = fmt.Errorf("open %s: %w", name, err)
			results = append(results, res)
			continue
		}
		br := bufio.NewReader(rc)
		h, err := ReadHeader(br)
		if err != nil {
			res.Err = fmt.Errorf("header %s: %w", name, err)
			results = append(results, res)
			continue
		}
		rows, err := countRows(br)
		rc.Close()
		if err != nil {
			res.Err = fmt.Errorf("rows %s: %w", name, err)
		} else {
			res.Account = h.Account
			res.Currency = h.Currency
			res.Rows = rows
		}
		results = append(results, res)
	}
	return results
}

func countRows(br *bufio.Reader) (int, error) {
	rows := 0
	for {
		line, err := br.ReadString('\n')
		if strings.TrimSpace(line) != "" {
			rows++
		}
		if err == io.EOF {
			return rows, nil
		}
		if err != nil {
			return rows, err
		}
	}
}

func Summarize(results []Result) Summary {
	var s Summary
	for _, r := range results {
		if r.Err != nil {
			s.Failed++
			continue
		}
		s.Imported++
		s.Rows += r.Rows
	}
	return s
}
