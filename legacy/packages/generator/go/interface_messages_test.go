package generator

import (
	"encoding/json"
	"os"
	"path/filepath"
	"reflect"
	"testing"
)

// TestInterfaceMessagesMatchesContract fails when interface_messages.go differs from
// contracts/interface-messages.json; run `go generate` to rewrite it (CUMK-065).
func TestInterfaceMessagesMatchesContract(t *testing.T) {
	raw, err := os.ReadFile(filepath.Join("..", "..", "..", "..", "contracts", "interface-messages.json"))
	if err != nil {
		t.Fatal(err)
	}
	var contract struct {
		Form map[string]map[string]string `json:"form"`
		List map[string]map[string]string `json:"list"`
	}
	if err := json.Unmarshal(raw, &contract); err != nil {
		t.Fatal(err)
	}

	if len(messageTables) != len(contract.Form) {
		t.Errorf("messageTables has %d languages, the contract %d; run go generate", len(messageTables), len(contract.Form))
	}
	for lang, contractMessages := range contract.Form {
		tableMessages, ok := messageTables[lang]
		if !ok {
			t.Errorf("Language %q not in messageTables", lang)
			continue
		}

		// Use reflection to check all struct fields
		v := reflect.ValueOf(tableMessages)
		for i := 0; i < v.NumField(); i++ {
			field := v.Type().Field(i)
			fieldValue := v.Field(i).String()
			contractValue, exists := contractMessages[field.Name]
			if !exists {
				t.Errorf("Field %q not found in contract for language %q", field.Name, lang)
				continue
			}
			if fieldValue != contractValue {
				t.Errorf("Language %q, field %q: got %q, contract %q; run go generate",
					lang, field.Name, fieldValue, contractValue)
			}
		}

		// Every contract key is a field of the table.
		fields := reflect.TypeOf(tableMessages)
		for contractKey := range contractMessages {
			if _, ok := fields.FieldByName(contractKey); !ok {
				t.Errorf("Language %q has key %q that formMessages lacks", lang, contractKey)
			}
		}
	}

	// Check list messages table matches contract
	if len(listMessagesTables) != len(contract.List) {
		t.Errorf("listMessagesTables has %d languages, the contract %d; run go generate", len(listMessagesTables), len(contract.List))
	}
	for lang, contractMessages := range contract.List {
		tableMessages, ok := listMessagesTables[lang]
		if !ok {
			t.Errorf("Language %q not in listMessagesTables", lang)
			continue
		}

		// Use reflection to check all struct fields
		v := reflect.ValueOf(tableMessages)
		for i := 0; i < v.NumField(); i++ {
			field := v.Type().Field(i)
			fieldValue := v.Field(i).String()
			contractValue, exists := contractMessages[field.Name]
			if !exists {
				t.Errorf("Field %q not found in list contract for language %q", field.Name, lang)
				continue
			}
			if fieldValue != contractValue {
				t.Errorf("Language %q, field %q: got %q, contract %q; run go generate",
					lang, field.Name, fieldValue, contractValue)
			}
		}

		// Every contract key is a field of the table.
		fields := reflect.TypeOf(tableMessages)
		for contractKey := range contractMessages {
			if _, ok := fields.FieldByName(contractKey); !ok {
				t.Errorf("Language %q has key %q that listMessages lacks", lang, contractKey)
			}
		}
	}
}
