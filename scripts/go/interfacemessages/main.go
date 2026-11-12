// Command interfacemessages writes interface_messages.go from contracts/interface-messages.json, the interface text
// every CRUDUI runtime embeds. Run it with `go generate` in legacy/packages/generator/go.
package main

import (
	"bytes"
	"fmt"
	"sort"

	"github.com/polyspec/crudui/scripts/go/tablegen"
)

// program names the generator in its messages.
const program = "interfacemessages"

// contract is the part of the contract the generator embeds.
type contract struct {
	Form map[string]map[string]string `json:"form"`
	List map[string]map[string]string `json:"list"`
}

func main() {
	var data contract
	output := tablegen.Run(program, &data)

	// Collect all form keys from all languages
	formKeySet := make(map[string]bool)
	for _, lang := range data.Form {
		for key := range lang {
			formKeySet[key] = true
		}
	}
	var formKeys []string
	for key := range formKeySet {
		formKeys = append(formKeys, key)
	}
	sort.Strings(formKeys)

	// Collect all list keys from all languages
	listKeySet := make(map[string]bool)
	for _, lang := range data.List {
		for key := range lang {
			listKeySet[key] = true
		}
	}
	var listKeys []string
	for key := range listKeySet {
		listKeys = append(listKeys, key)
	}
	sort.Strings(listKeys)

	var b bytes.Buffer
	b.WriteString("// Code generated from contracts/interface-messages.json by `go generate` (scripts/go/interfacemessages). DO NOT EDIT.\n\n")
	b.WriteString("package generator\n\n")

	// Write the messageTables variable for form messages
	b.WriteString("var messageTables = map[string]formMessages{\n")

	languages := []string{"ko", "en", "ja", "zh"}
	for _, lang := range languages {
		fmt.Fprintf(&b, "%q: {\n", lang)
		langData := data.Form[lang]
		for _, key := range formKeys {
			value := langData[key]
			fmt.Fprintf(&b, "%s: %q,\n", key, value)
		}
		b.WriteString("},\n")
	}
	b.WriteString("}\n\n")

	// Write the listMessagesTables variable for list messages
	b.WriteString("var listMessagesTables = map[string]listMessages{\n")

	for _, lang := range languages {
		fmt.Fprintf(&b, "%q: {\n", lang)
		langData := data.List[lang]
		for _, key := range listKeys {
			value := langData[key]
			fmt.Fprintf(&b, "%s: %q,\n", key, value)
		}
		b.WriteString("},\n")
	}
	b.WriteString("}\n")

	tablegen.WriteSource(program, &b, output)
}
