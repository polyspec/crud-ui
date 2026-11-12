package compose

// File loader for $ref resolution (port of loader.ts).
//
// $ref loads external YAML files. The
// compose engine never touches the filesystem directly — it goes through a
// FileLoader, so the shared fixtures supply a virtual in-memory file set while
// production wires a real disk + YAML loader. One engine, two backends —
// identical semantics.
//
// Path normalization:
//   - absolute (/…) paths pass through unchanged
//   - relative paths get the basepath prefix (basepath + "/" + path)
//
// The loader receives the ALREADY-normalized absolute key, so cycle detection
// and the fixture map key on one canonical identifier.

// FileLoader resolves a normalized file key to its parsed document. Load returns
// a *ComposeLoadError with code RefFileNotFound when the key is absent — the
// engine relies on that exact code (an unresolved $ref is a load error, never
// valid:true).
type FileLoader interface {
	// Normalize resolves path against basepath to the canonical key the map uses.
	Normalize(path, basepath string) string
	// Load returns the parsed document at the canonical key, or a NOT_FOUND error.
	Load(key string) (*OMap, error)
}

// MemoryLoader is an in-memory loader over a fixed { key: doc } map. Shared
// fixtures pass a file set here; the engine resolves $ref against it with no disk
// access. Keys are the normalized identifiers (Normalize output).
type MemoryLoader struct {
	files map[string]*OMap
}

// NewMemoryLoader builds a MemoryLoader from a { key: doc } map. Each doc must be
// an *OMap (a parsed object). A defensive clone is taken on Load so resolution
// never mutates the source set.
func NewMemoryLoader(files map[string]*OMap) *MemoryLoader {
	cp := make(map[string]*OMap, len(files))
	for k, v := range files {
		cp[k] = v
	}
	return &MemoryLoader{files: cp}
}

// Normalize passes an absolute path through unchanged; a relative path is
// prefixed by basepath.
func (l *MemoryLoader) Normalize(path, basepath string) string {
	if len(path) > 0 && path[0] == '/' {
		return path
	}
	if basepath != "" {
		return basepath + "/" + path
	}
	return path
}

// Load returns a copy of the parsed doc at key in specification member order, or a
// RefFileNotFound load error. The copy keeps resolution from mutating the source
// file set (mirrors structuredClone(doc) on the JS side).
func (l *MemoryLoader) Load(key string) (*OMap, error) {
	doc, ok := l.files[key]
	if !ok {
		return nil, newLoadError(RefFileNotFound, "$ref file not found: "+key, key)
	}
	return orderedOMap(doc), nil
}
