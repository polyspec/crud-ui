package expr

import (
	"container/list"
	"fmt"
	"sync"
)

// Public facade for the model expression engine: string → tokens → AST → value.
//
// The pipeline is strictly staged (GRAMMAR §0): never split a string to
// evaluate, never eval. Parse caches one AST per expression string. Evaluate
// returns a boolean condition result; EvaluateValue returns a ternary's branch
// value and the boolean condition result for everything else (JS
// evaluateExpressionValue parity — the shared 4-language fixture is generated
// from the JS engine).

// cacheEntry holds a cached AST node with expression key.
type cacheEntry struct {
	expression string
	node       Node
}

// lruCache is a bounded LRU cache for expression ASTs.
type lruCache struct {
	maxSize int
	cache   map[string]*list.Element
	list    *list.List
	mu      sync.Mutex
}

// newLRUCache creates a new bounded LRU cache with the given capacity.
func newLRUCache(capacity int) *lruCache {
	return &lruCache{
		maxSize: capacity,
		cache:   make(map[string]*list.Element),
		list:    list.New(),
	}
}

// get retrieves a cached AST node and marks it as recently used.
func (c *lruCache) get(expression string) (Node, bool) {
	// One lock covers the lookup and the move, so no eviction happens in between.
	c.mu.Lock()
	defer c.mu.Unlock()
	elem, ok := c.cache[expression]
	if !ok {
		return nil, false
	}
	c.list.MoveToFront(elem)
	return entryOf(elem).node, true
}

// entryOf returns the cacheEntry that an LRU list element holds. The list holds only
// cacheEntry values, so the assertion cannot fail.
func entryOf(elem *list.Element) cacheEntry {
	entry, ok := elem.Value.(cacheEntry)
	if !ok {
		panic(fmt.Sprintf("expr: LRU element holds %T, not cacheEntry", elem.Value))
	}
	return entry
}

// set stores an AST node in the cache.
func (c *lruCache) set(expression string, node Node) {
	c.mu.Lock()
	defer c.mu.Unlock()

	// Check if already exists
	if elem, ok := c.cache[expression]; ok {
		// Update and move to front
		elem.Value = cacheEntry{expression, node}
		c.list.MoveToFront(elem)
		return
	}

	// Create new entry
	entry := cacheEntry{expression, node}
	elem := c.list.PushFront(entry)
	c.cache[expression] = elem

	// Evict if over capacity
	if c.list.Len() > c.maxSize {
		c.evictLRU()
	}
}

// evictLRU removes the least recently used entry (tail of the list).
func (c *lruCache) evictLRU() {
	if elem := c.list.Back(); elem != nil {
		c.list.Remove(elem)
		delete(c.cache, entryOf(elem).expression)
	}
}

// clear empties the cache.
func (c *lruCache) clear() {
	c.mu.Lock()
	defer c.mu.Unlock()

	c.cache = make(map[string]*list.Element)
	c.list = list.New()
}

// size returns the current number of entries in the cache.
func (c *lruCache) size() int {
	c.mu.Lock()
	defer c.mu.Unlock()

	return c.list.Len()
}

var astCache = newLRUCache(1000)

// Tokenize tokenizes an expression. WHITESPACE excluded; ends with EOF. Returns
// an error only if the lexer hits malformed input (e.g. unterminated string).
func Tokenize(expression string) (tokens []Token, err error) {
	defer func() {
		if r := recover(); r != nil {
			if pe, ok := r.(*ParseError); ok {
				tokens, err = nil, pe
				return
			}
			panic(r)
		}
	}()
	return NewLexer(expression).Tokenize(), nil
}

// Parse parses an expression into its AST (cached). Returns *ParseError on
// malformed input.
func Parse(expression string) (node Node, err error) {
	if cached, ok := astCache.get(expression); ok {
		return cached, nil
	}

	defer func() {
		if r := recover(); r != nil {
			if pe, ok := r.(*ParseError); ok {
				node, err = nil, pe
				return
			}
			panic(r)
		}
	}()

	tokens := NewLexer(expression).Tokenize()
	ast := NewParser(tokens).Parse()

	astCache.set(expression, ast)

	return ast, nil
}

// Evaluate evaluates an expression to a truthy boolean (show/display call site).
func Evaluate(expression string, formData map[string]any, currentPath []string, rowKeys []int) (bool, error) {
	ast, err := Parse(expression)
	if err != nil {
		return false, err
	}
	return NewEvaluator(formData, currentPath, rowKeys).Evaluate(ast), nil
}

// EvaluateValue evaluates an expression to its raw value (class/style/number/null
// call site).
func EvaluateValue(expression string, formData map[string]any, currentPath []string, rowKeys []int) (any, error) {
	ast, err := Parse(expression)
	if err != nil {
		return nil, err
	}
	return NewEvaluator(formData, currentPath, rowKeys).EvaluateValue(ast), nil
}

// ClearCache clears the parsed-AST cache.
func ClearCache() {
	astCache.clear()
}
