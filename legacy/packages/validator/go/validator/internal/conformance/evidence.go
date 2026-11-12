// Package conformance records the validation fixtures through the shared Go test support.
package conformance

import (
	"testing"

	support "github.com/polyspec/crudui/packages/validator/go/testsupport/conformance"
)

// Record records the fixture case result after its cleanup has completed.
func Record(t testing.TB, feature, fixture, name string) {
	t.Helper()
	support.Record(t, feature, fixture, name)
}
