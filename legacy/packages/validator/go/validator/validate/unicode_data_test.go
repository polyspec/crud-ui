package validate

import (
	"encoding/json"
	"os"
	"path/filepath"
	"reflect"
	"testing"
)

// TestUnicodeDataMatchesContract checks the Unicode data of CUVR-018: it fails when unicode_data.go differs from
// contracts/unicode-properties.json; run `go generate` to rewrite it.
func TestUnicodeDataMatchesContract(t *testing.T) {
	raw, err := os.ReadFile(filepath.Join("..", "..", "..", "..", "..", "..", "contracts", "unicode-properties.json"))
	if err != nil {
		t.Fatal(err)
	}
	var contract struct {
		UnicodeVersion    string               `json:"unicodeVersion"`
		WhiteSpace        [][2]rune            `json:"whiteSpace"`
		GeneralCategories map[string][][2]rune `json:"generalCategories"`
		Scripts           map[string][][2]rune `json:"scripts"`
	}
	if err := json.Unmarshal(raw, &contract); err != nil {
		t.Fatal(err)
	}
	ranges := func(list [][2]rune) []codeRange {
		out := make([]codeRange, len(list))
		for i, r := range list {
			out[i] = codeRange{r[0], r[1]}
		}
		return out
	}
	named := func(m map[string][][2]rune) map[string][]codeRange {
		out := make(map[string][]codeRange, len(m))
		for name, list := range m {
			out[name] = ranges(list)
		}
		return out
	}
	if contract.UnicodeVersion != unicodeDataVersion {
		t.Errorf("Unicode version %q, contract %q", unicodeDataVersion, contract.UnicodeVersion)
	}
	if !reflect.DeepEqual(ranges(contract.WhiteSpace), unicodeWhiteSpace) {
		t.Error("whiteSpace differs from the contract; run go generate")
	}
	if !reflect.DeepEqual(named(contract.GeneralCategories), unicodeGeneralCategories) {
		t.Error("generalCategories differ from the contract; run go generate")
	}
	if !reflect.DeepEqual(named(contract.Scripts), unicodeScripts) {
		t.Error("scripts differ from the contract; run go generate")
	}
	// Membership uses binary search, which needs sorted, disjoint ranges.
	check := func(name string, list []codeRange) {
		if !reflect.DeepEqual(normalizeRanges(list), list) {
			t.Errorf("%s ranges are not sorted, disjoint and merged", name)
		}
	}
	check("whiteSpace", unicodeWhiteSpace)
	for name, list := range unicodeGeneralCategories {
		check(name, list)
	}
	for name, list := range unicodeScripts {
		check(name, list)
	}
}
