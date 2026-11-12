package generator

import "testing"

func TestStyleDeclarationParsingPreservesValues(t *testing.T) {
	source := `content: "a;b:c"; background:url("data:image/svg+xml;a:b;c"); --config:{x:y;z:a}; color:red; color:blue; /* note */ width:calc(100% - 1px)`
	want := `content: "a;b:c"; background: url("data:image/svg+xml;a:b;c"); --config: {x:y;z:a}; color: red; color: blue; width: calc(100% - 1px)`
	if got := styleString(source); got != want {
		t.Fatalf("%s\n%s", got, want)
	}
	html := `content:"a;b:c";background:url("data:image/svg+xml;a:b;c");--config:{x:y;z:a};color:blue;width:calc(100% - 1px)`
	if got := compactStyle(source); got != html {
		t.Fatalf("%s\n%s", got, html)
	}
}
func TestStyleEscapesCommentsAndEmptyValues(t *testing.T) {
	source := `--x:a\;b; content:'x\';y'; color:/* ; : */red!important; empty:; broken; height:10px`
	want := `--x: a\;b; content: 'x\';y'; color: /* ; : */red!important; height: 10px`
	if got := styleString(source); got != want {
		t.Fatalf("%s\n%s", got, want)
	}
}
