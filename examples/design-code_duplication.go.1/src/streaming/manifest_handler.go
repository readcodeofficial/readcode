package streaming

import (
	"bufio"
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"io"
	"net/http"
	"path"
	"strconv"
	"strings"
	"time"
)

const segmentLinkTTL = 10 * time.Minute

type ManifestHandler struct {
	key    []byte
	root   http.FileSystem
	signer *Signer
}

func (h *ManifestHandler) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	expStr := q.Get("exp")
	exp, err := strconv.ParseInt(expStr, 10, 64)
	if err != nil || time.Now().Unix() > exp {
		http.Error(w, "link expired", http.StatusForbidden)
		return
	}
	sig, err := hex.DecodeString(q.Get("sig"))
	if err != nil {
		http.Error(w, "bad signature", http.StatusForbidden)
		return
	}
	mac := hmac.New(sha256.New, h.key)
	mac.Write([]byte(r.URL.Path + "|" + expStr))
	if !hmac.Equal(sig, mac.Sum(nil)) {
		http.Error(w, "bad signature", http.StatusForbidden)
		return
	}

	id := r.PathValue("id")
	f, err := h.root.Open(path.Join("/", id, "index.m3u8"))
	if err != nil {
		http.NotFound(w, r)
		return
	}
	defer f.Close()

	var out strings.Builder
	scanner := bufio.NewScanner(f)
	for scanner.Scan() {
		line := scanner.Text()
		if line != "" && !strings.HasPrefix(line, "#") {
			line = h.signer.Sign("/segments/"+id+"/"+line, segmentLinkTTL)
		}
		out.WriteString(line)
		out.WriteByte('\n')
	}
	if err := scanner.Err(); err != nil {
		http.Error(w, "playlist unreadable", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/vnd.apple.mpegurl")
	w.Header().Set("Cache-Control", "no-store")
	io.WriteString(w, out.String())
}
