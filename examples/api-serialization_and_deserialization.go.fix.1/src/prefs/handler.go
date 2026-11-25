package prefs

import (
	"encoding/json"
	"net/http"
	"strings"
)

// Handler serves GET and PATCH on /users/{id}/preferences.
type Handler struct {
	store *MemoryStore
}

func NewHandler(store *MemoryStore) *Handler {
	return &Handler{store: store}
}

func (h *Handler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	path := strings.Trim(r.URL.Path, "/")
	parts := strings.Split(path, "/")
	if len(parts) != 3 || parts[0] != "users" || parts[2] != "preferences" {
		writeError(w, http.StatusNotFound, "not found")
		return
	}
	userID := parts[1]

	switch r.Method {
	case http.MethodGet:
		writeJSON(w, http.StatusOK, h.store.Get(userID))
	case http.MethodPatch:
		h.patch(w, r, userID)
	default:
		w.Header().Set("Allow", "GET, PATCH")
		writeError(w, http.StatusMethodNotAllowed, "method not allowed")
	}
}

func (h *Handler) patch(w http.ResponseWriter, r *http.Request, userID string) {
	var req UpdateRequest
	dec := json.NewDecoder(r.Body)
	dec.DisallowUnknownFields()
	if err := dec.Decode(&req); err != nil {
		writeError(w, http.StatusBadRequest, "invalid JSON body: "+err.Error())
		return
	}
	if err := req.Validate(); err != nil {
		writeError(w, http.StatusUnprocessableEntity, err.Error())
		return
	}
	updated := req.Apply(h.store.Get(userID))
	h.store.Put(userID, updated)
	writeJSON(w, http.StatusOK, updated)
}

func writeJSON(w http.ResponseWriter, status int, v any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(v)
}

func writeError(w http.ResponseWriter, status int, msg string) {
	writeJSON(w, status, map[string]string{"error": msg})
}
