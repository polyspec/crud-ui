package generator

// outlineChildren returns the child nodes of a node, none when it has no children list.
func outlineChildren(node *Object) []*Object { return objectList(read(node, "children")) }

// outlineRows returns the rows under nodes, looking through every node that is not a collection.
func outlineRows(nodes []*Object) []*Object {
	out := []*Object{}
	for _, node := range nodes {
		if stringAt(node, "kind") != "collection" {
			out = append(out, outlineRows(outlineChildren(node))...)
			continue
		}
		path := stringAt(node, "path")
		for _, row := range outlineChildren(node) {
			out = append(out, outlineEntry(path, row))
		}
	}
	return out
}

// outlineEntry returns the entry of one row of the collection at path, with the rows nested in it.
func outlineEntry(path string, row *Object) *Object {
	entry := NewObject("path", path, "key", stringAt(row, "key"))
	header := read(row, "header")
	for _, name := range []string{"number", "title"} {
		if value := read(header, name); !isAbsent(value) && value != nil {
			entry.Set(name, value)
		}
	}
	if stringAt(read(row, "controls"), "placement") == "outline" {
		entry.Set("controls", read(row, "controls"))
	}
	entry.Set("rows", outlineRows(outlineChildren(row)))
	return entry
}

// BuildOutline builds the structure map: the form's rows, nested as in the form. Collections, counts and empty
// collections are not rows.
func BuildOutline(nodes []*Object) []*Object { return outlineRows(nodes) }
