package feedsync

import (
	"bufio"
	"bytes"
	"encoding/json"
	"fmt"
)

// Item is one product line of a supplier feed (one JSON object per line).
type Item struct {
	SKU        string `json:"sku"`
	PriceCents int    `json:"price_cents"`
}

func DecodeFeed(data []byte) ([]Item, error) {
	var items []Item
	sc := bufio.NewScanner(bytes.NewReader(data))
	line := 0
	for sc.Scan() {
		line++
		if len(bytes.TrimSpace(sc.Bytes())) == 0 {
			continue
		}
		var it Item
		if err := json.Unmarshal(sc.Bytes(), &it); err != nil {
			return nil, fmt.Errorf("line %d: %w", line, err)
		}
		if it.SKU == "" || it.PriceCents < 0 {
			return nil, fmt.Errorf("line %d: invalid item", line)
		}
		items = append(items, it)
	}
	return items, sc.Err()
}
