package generator

//go:generate go run github.com/polyspec/crudui/scripts/go/interfacemessages -contract ../../../../contracts/interface-messages.json -out interface_messages.go

import (
	"strconv"
	"strings"
)

// formMessages holds the interface text of row, collection and form controls. `{count}` is replaced by a number.
type formMessages struct {
	moveUp, moveDown, addRow, copyRow, removeRow, toggleRow string
	expandAll, collapseAll, undo, redo                      string
	rowControls, collectionControls, formControls           string
	formActions, submit, reset                              string
	outline, data, untitled, collapsed, count, children     string
	// The structured condition editor (docs/spec/form-markup.md, Structured condition editor).
	conditionMode, conditionAddComparison, conditionAddGroup string
	conditionAddJudge, conditionRemove, conditionInvalid     string
}

// listMessages holds the interface text of list pagination buttons and empty state.
// `{page}` is replaced by a page number.
type listMessages struct {
	previousPage, nextPage, page, emptyList string
}

// messagesFor returns the interface text of a supported language: ko, en, ja or zh.
func messagesFor(language string) (formMessages, error) {
	m, ok := messageTables[language]
	if !ok {
		return formMessages{}, inputError("Unsupported language: %s", language)
	}
	return m, nil
}

// listMessagesFor returns the interface text for list pagination of a supported language: ko, en, ja or zh.
func listMessagesFor(language string) listMessages {
	if m, ok := listMessagesTables[language]; ok {
		return m
	}
	return listMessagesTables["en"]
}

// formatCount replaces `{count}` in a counted message.
func formatCount(template string, count int) string {
	return strings.Replace(template, "{count}", strconv.Itoa(count), 1)
}

// formatPage replaces `{page}` in a page message template.
func formatPage(template string, page int64) string {
	return strings.Replace(template, "{page}", strconv.FormatInt(page, 10), 1)
}
