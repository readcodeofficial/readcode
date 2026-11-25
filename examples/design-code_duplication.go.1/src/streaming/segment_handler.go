package streaming

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"net/http"
	"path"
)

type SegmentHandler struct {
	key  []byte
	root http.FileSystem
}

func (h *SegmentHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	exp := q.Get("exp")
	sig, err := hex.DecodeString(q.Get("sig"))
	if err != nil {
		http.Error(w, "bad signature", http.StatusForbidden)
		return
	}
	mac := hmac.New(sha256.New, h.key)
	mac.Write([]byte(r.URL.Path + "|" + exp))
	if !hmac.Equal(sig, mac.Sum(nil)) {
		http.Error(w, "bad signature", http.StatusForbidden)
		return
	}

	name := r.PathValue("name")
	f, err := h.root.Open(path.Join("/", r.PathValue("id"), name))
	if err != nil {
		http.NotFound(w, r)
		return
	}
	defer f.Close()
	info, err := f.Stat()
	if err != nil || info.IsDir() {
		http.NotFound(w, r)
		return
	}

	w.Header().Set("Cache-Control", "private, max-age=600")
	http.ServeContent(w, r, name, info.ModTime(), f)
}
