package generator

import "strings"

// preloadLinks collects the preload links of the images that a view model shows, each source once.
type preloadLinks struct {
	seen map[string]bool
	out  strings.Builder
}

func newPreloadLinks() *preloadLinks {
	return &preloadLinks{seen: map[string]bool{}}
}

// add writes the preload link of a display model when it is an image with a source that is not
// a data URL and has not been preloaded.
func (p *preloadLinks) add(display *Object) {
	if display == nil || stringAt(display, "kind") != "image" {
		return
	}
	src := stringAt(display, "src")
	if src == "" || strings.HasPrefix(strings.ToLower(src), "data:") || p.seen[src] {
		return
	}
	p.seen[src] = true
	p.out.WriteString("<link" + attrs(NewObject("rel", "preload", "as", "image", "href", src), false, false) + "/>")
}

// String is the links in the order they were added.
func (p *preloadLinks) String() string {
	return p.out.String()
}
