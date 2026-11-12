// Package conformance records conformance evidence for Go tests.
//
// A test that runs a shared fixture case records the feature it proves, the
// fixture, the runtime and the case. Nothing is written unless the environment
// variable CRUDUI_CONFORMANCE_EVIDENCE names a directory;
// scripts/check-conformance.mts reads it. The format matches
// tests/conformance/evidence.mts.
package conformance

import (
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"
	"testing"
)

// runtime is the runtime key of Go fixture tests in contracts/features.json.
const runtime = "go"

// evidence is one recorded line; field order is the line's key order.
type evidence struct {
	Feature string `json:"feature"`
	Fixture string `json:"fixture"`
	Runtime string `json:"runtime"`
	Case    string `json:"case"`
	Passed  bool   `json:"passed"`
}

// Record registers a cleanup on t that records whether the fixture case name
// passed. Call it at the start of the subtest that runs exactly that case, so
// the result reflects the case and every subtest it runs. Empty arguments fail
// the test.
func Record(t testing.TB, feature, fixture, name string) {
	t.Helper()
	for key, value := range map[string]string{"feature": feature, "fixture": fixture, "case": name} {
		if value == "" {
			t.Fatalf("conformance evidence %s must be a non-empty string", key)
		}
	}
	t.Cleanup(func() {
		directory := os.Getenv("CRUDUI_CONFORMANCE_EVIDENCE")
		if directory == "" {
			return
		}
		if err := write(directory, evidence{feature, fixture, runtime, name, !t.Failed()}); err != nil {
			t.Errorf("conformance evidence: %v", err)
		}
	})
}

// write appends one JSON line to <directory>/go-<pid>.jsonl.
func write(directory string, item evidence) error {
	line, err := json.Marshal(item)
	if err != nil {
		return err
	}
	if err := os.MkdirAll(directory, 0o755); err != nil {
		return err
	}
	path := filepath.Join(directory, fmt.Sprintf("%s-%d.jsonl", runtime, os.Getpid()))
	file, err := os.OpenFile(path, os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0o644)
	if err != nil {
		return err
	}
	_, err = file.Write(append(line, '\n'))
	return errors.Join(err, file.Close())
}
