package expr

// AST node set (expressions.md §4). Field names follow the JS reference
// (ConditionParser.ts); ToMap() emits the JS serialization the 4-language
// equivalence compares (position-free, GRAMMAR §4 position note).
//
//	Ternary { type:'Ternary', condition, trueValue, falseValue }
//	Binary  { type:'Binary', operator, left, right }
//	Unary   { type:'Unary', operator, operand }
//	In      { type:'In', negated, value, list:[] }
//	Path    { type:'Path', relative, levelsUp, segments:[] }
//	Literal { type:'Literal', valueType, value }
//	Group   { type:'Group', expression }
//
// PathSegment = {type:'identifier', value} | {type:'wildcard'} | {type:'index', value:number}

// Node is one AST node. ToMap renders the JS serialization shape.
type Node interface {
	// ToMap serializes the node (and its children) to the shared-fixture AST shape.
	ToMap() map[string]any
}

// TernaryNode is cond ? trueValue : falseValue (right-associative).
type TernaryNode struct {
	Condition  Node
	TrueValue  Node
	FalseValue Node
}

// ToMap serializes the Ternary node and its children to the shared-fixture
// AST shape {type, condition, trueValue, falseValue}.
func (n *TernaryNode) ToMap() map[string]any {
	return map[string]any{
		"type":       "Ternary",
		"condition":  n.Condition.ToMap(),
		"trueValue":  n.TrueValue.ToMap(),
		"falseValue": n.FalseValue.ToMap(),
	}
}

// BinaryNode is a comparison (== != > >= < <=) or logical (&& ||) operation.
type BinaryNode struct {
	Operator string
	Left     Node
	Right    Node
}

// ToMap serializes the Binary node and its operands to the shared-fixture AST
// shape {type, operator, left, right}.
func (n *BinaryNode) ToMap() map[string]any {
	return map[string]any{
		"type":     "Binary",
		"operator": n.Operator,
		"left":     n.Left.ToMap(),
		"right":    n.Right.ToMap(),
	}
}

// UnaryNode is the logical-not operation ("!" operand).
type UnaryNode struct {
	Operator string
	Operand  Node
}

// ToMap serializes the Unary node and its operand to the shared-fixture AST
// shape {type, operator, operand}.
func (n *UnaryNode) ToMap() map[string]any {
	return map[string]any{
		"type":     "Unary",
		"operator": n.Operator,
		"operand":  n.Operand.ToMap(),
	}
}

// InNode is value in/not-in list. List holds Literal nodes.
type InNode struct {
	Negated bool
	Value   Node
	List    []Node
}

// ToMap serializes the In node and its list to the shared-fixture AST shape
// {type, negated, value, list}.
func (n *InNode) ToMap() map[string]any {
	list := make([]any, len(n.List))
	for i, item := range n.List {
		list[i] = item.ToMap()
	}
	return map[string]any{
		"type":    "In",
		"negated": n.Negated,
		"value":   n.Value.ToMap(),
		"list":    list,
	}
}

// PathSegment is one Path step. Type is "identifier", "wildcard", or "index".
type PathSegment struct {
	Type  string
	Value string // identifier name
	Index int    // index value
}

// ToMap serializes the segment to the JS segment shape (index value as number).
func (s PathSegment) ToMap() map[string]any {
	switch s.Type {
	case "identifier":
		return map[string]any{"type": "identifier", "value": s.Value}
	case "wildcard":
		return map[string]any{"type": "wildcard"}
	case "index":
		return map[string]any{"type": "index", "value": s.Index}
	default:
		return map[string]any{"type": s.Type}
	}
}

// PathNode is a field reference. Relative true => "."/".."; LevelsUp is parents
// to ascend (".x"=0, "..x"=1). Segments are the dotted path after the prefix.
type PathNode struct {
	Relative bool
	LevelsUp int
	Segments []PathSegment
}

// ToMap serializes the Path node and its segments to the shared-fixture AST
// shape {type, relative, levelsUp, segments}.
func (n *PathNode) ToMap() map[string]any {
	segs := make([]any, len(n.Segments))
	for i, s := range n.Segments {
		segs[i] = s.ToMap()
	}
	return map[string]any{
		"type":     "Path",
		"relative": n.Relative,
		"levelsUp": n.LevelsUp,
		"segments": segs,
	}
}

// LiteralNode is a constant. ValueType is "string"|"number"|"boolean"|"null".
type LiteralNode struct {
	ValueType string
	Value     any
}

// ToMap serializes the Literal node to the shared-fixture AST shape {type,
// valueType, value}.
func (n *LiteralNode) ToMap() map[string]any {
	return map[string]any{
		"type":      "Literal",
		"valueType": n.ValueType,
		"value":     n.Value,
	}
}

// GroupNode is a parenthesized expression.
type GroupNode struct {
	Expression Node
}

// ToMap serializes the Group node and its inner expression to the
// shared-fixture AST shape {type, expression}.
func (n *GroupNode) ToMap() map[string]any {
	return map[string]any{
		"type":       "Group",
		"expression": n.Expression.ToMap(),
	}
}
