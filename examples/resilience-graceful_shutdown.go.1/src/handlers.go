package main

import (
	"encoding/json"
	"errors"
	"net/http"
)

func createPayRun(runner *Runner) http.HandlerFunc {
	return func(w http.ResponseWriter, req *http.Request) {
		var run PayRun
		if err := json.NewDecoder(http.MaxBytesReader(w, req.Body, 1<<20)).Decode(&run); err != nil {
			http.Error(w, "invalid body", http.StatusBadRequest)
			return
		}
		if run.ID == "" || len(run.Employees) == 0 {
			http.Error(w, "id and employees are required", http.StatusUnprocessableEntity)
			return
		}
		if err := runner.Submit(run); err != nil {
			if errors.Is(err, ErrBusy) || errors.Is(err, ErrClosed) {
				w.Header().Set("Retry-After", "30")
			}
			http.Error(w, err.Error(), http.StatusServiceUnavailable)
			return
		}
		w.WriteHeader(http.StatusAccepted)
	}
}
