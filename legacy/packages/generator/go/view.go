package generator

import "strings"

// ViewState is the view state of a form kept outside the record data: the row paths {collection}.{key} rendered
// collapsed, in the order the rows were collapsed, without duplicates. It is never submitted with the data.
type ViewState struct {
	// Collapsed lists the collapsed row paths.
	Collapsed []string
}

// InitialView returns the view with no collapsed row. Replacing the record returns to it.
func InitialView() ViewState { return ViewState{Collapsed: []string{}} }

// rowPathContains reports whether path is the row path rowPath or lies inside that row.
func rowPathContains(rowPath, path string) bool {
	return path == rowPath || strings.HasPrefix(path, rowPath+".")
}

// CollapsibleRows returns the row paths {collection}.{key} of every collapsible row of the evaluated nodes, depth
// first in node order.
func CollapsibleRows(nodes []*Object) []string {
	out := []string{}
	collectCollapsible(nodes, &out)
	return out
}

func collectCollapsible(nodes []*Object, out *[]string) {
	for _, node := range nodes {
		if stringAt(node, "kind") == "collection" {
			for _, row := range objectList(read(node, "children")) {
				if read(row, "collapsible") == true {
					*out = append(*out, stringAt(node, "path")+"."+stringAt(row, "key"))
				}
				collectCollapsible(objectList(read(row, "children")), out)
			}
			continue
		}
		collectCollapsible(objectList(read(node, "children")), out)
	}
}

// ToggleRowView expands a collapsed row or collapses an expanded one, appending a collapsed row last.
func ToggleRowView(view ViewState, rowPath string) ViewState {
	collapsed := []string{}
	found := false
	for _, path := range view.Collapsed {
		if path == rowPath {
			found = true
			continue
		}
		collapsed = append(collapsed, path)
	}
	if !found {
		collapsed = append(collapsed, rowPath)
	}
	return ViewState{Collapsed: collapsed}
}

// SetAllExpandedView returns the view with no collapsed row when expanded is true, and otherwise the view that
// collapses every collapsible row of the evaluated nodes.
func SetAllExpandedView(nodes []*Object, expanded bool) ViewState {
	if expanded {
		return InitialView()
	}
	return ViewState{Collapsed: CollapsibleRows(nodes)}
}

// RemoveRowView drops the collapsed state of a removed row and of the rows inside it.
func RemoveRowView(view ViewState, rowPath string) ViewState {
	collapsed := []string{}
	for _, path := range view.Collapsed {
		if !rowPathContains(rowPath, path) {
			collapsed = append(collapsed, path)
		}
	}
	return ViewState{Collapsed: collapsed}
}

// RekeyRowView moves the collapsed state of a rekeyed row and of the rows inside it to the new row path.
func RekeyRowView(view ViewState, oldPath, newPath string) ViewState {
	collapsed := make([]string, len(view.Collapsed))
	for i, path := range view.Collapsed {
		if rowPathContains(oldPath, path) {
			path = newPath + path[len(oldPath):]
		}
		collapsed[i] = path
	}
	return ViewState{Collapsed: dedupe(collapsed)}
}

// dedupe keeps the first occurrence of each path.
func dedupe(paths []string) []string {
	seen := map[string]bool{}
	out := []string{}
	for _, path := range paths {
		if !seen[path] {
			seen[path] = true
			out = append(out, path)
		}
	}
	return out
}
