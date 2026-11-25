package tickets

import (
	"fmt"
	"sort"
	"strings"
)

// Report summarises holds against capacity, one line per event, sorted by name.
func Report(b *BoxOffice, capacity map[string]int) string {
	names := make([]string, 0, len(capacity))
	for name := range capacity {
		names = append(names, name)
	}
	sort.Strings(names)
	var sb strings.Builder
	for _, name := range names {
		held := b.Held(name)
		line := fmt.Sprintf("%s: %d/%d held", name, held, capacity[name])
		if held > capacity[name] {
			line += " OVERSOLD"
		}
		sb.WriteString(line + "\n")
	}
	return sb.String()
}
