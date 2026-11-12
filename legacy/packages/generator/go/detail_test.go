package generator

import "testing"

func TestBuildDetailUsesSharedDisplayEngine(t *testing.T) {
	vm, err := BuildDetail(NewObject("fields", NewObject(
		"name", NewObject("field", ".name", "label", "Name"),
		"state", NewObject("field", ".state", "format", NewObject("type", "badge", "map", NewObject("active", "success"))),
	)), NewObject("name", "Ada", "state", "active"), DetailOptions{})
	if err != nil {
		t.Fatal(err)
	}
	fields := objectList(read(vm, "fields"))
	if len(fields) != 2 || stringAt(fields[0], "display") != "Ada" {
		t.Fatalf("unexpected detail fields: %#v", fields)
	}
	if stringAt(object(read(fields[1], "display")), "kind") != "badge" {
		t.Fatalf("expected badge display: %#v", fields[1])
	}
}

func TestRenderDetailIsReadOnly(t *testing.T) {
	html, err := RenderDetail(NewObject("fields", NewObject("name", NewObject("field", ".name", "label", "Name"))), NewObject("name", "Ada"), DetailOptions{})
	if err != nil {
		t.Fatal(err)
	}
	if html != `<dl class="crudui-detail"><div class="crudui-detail__field"><dt class="crudui-detail__label">Name</dt><dd class="crudui-detail__value crudui-value crudui-value--text">Ada</dd></div></dl>` {
		t.Fatalf("unexpected detail HTML: %s", html)
	}
}
