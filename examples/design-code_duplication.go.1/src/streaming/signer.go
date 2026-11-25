package streaming

import (
	"crypto/hmac"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"net/http"
	"strconv"
	"time"
)

type Signer struct {
	key []byte
	now func() time.Time
}

func NewSigner(key []byte) *Signer {
	return &Signer{key: key, now: time.Now}
}

func (s *Signer) Sign(path string, ttl time.Duration) string {
	exp := strconv.FormatInt(s.now().Add(ttl).Unix(), 10)
	mac := hmac.New(sha256.New, s.key)
	mac.Write([]byte(path + "|" + exp))
	return fmt.Sprintf("%s?exp=%s&sig=%s", path, exp, hex.EncodeToString(mac.Sum(nil)))
}

func NewRouter(key []byte, root http.FileSystem) http.Handler {
	mux := http.NewServeMux()
	mux.Handle("GET /streams/{id}/index.m3u8", &ManifestHandler{key: key, root: root, signer: NewSigner(key)})
	mux.Handle("GET /segments/{id}/{name}", &SegmentHandler{key: key, root: root})
	return mux
}
