//! CRUDUI expression AST nodes (expressions.md §4, JS `ConditionParser.ts` parity).
//!
//! `to_value()` emits the canonical fixture shape, byte-matching the JS reference
//! field names: `Ternary{condition,trueValue,falseValue}`, `Binary{operator,left,
//! right}`, `Unary{operator,operand}`, `In{negated,value,list}`, `Path{relative,
//! levelsUp,segments}`, `Literal{valueType,value}`, `Group{expression}`. The
//! JS/Go `position` field is DELIBERATELY ABSENT — Rust holds no position, so the
//! 4-language AST contract excludes it; including it would break cross-language
//! fixture equality.

use serde_json::{json, Number, Value};

/// A literal's value kind plus its concrete value (number kept as int or float so
/// the fixture's integer literals stay integers when serialized).
#[derive(Debug, Clone, PartialEq)]
pub enum LiteralValue {
    /// `valueType:"string"`.
    Str(String),
    /// `valueType:"number"`, integral.
    Int(i64),
    /// `valueType:"number"`, fractional.
    Float(f64),
    /// `valueType:"boolean"`.
    Bool(bool),
    /// `valueType:"null"`.
    Null,
}

impl LiteralValue {
    fn value_type(&self) -> &'static str {
        match self {
            LiteralValue::Str(_) => "string",
            LiteralValue::Int(_) | LiteralValue::Float(_) => "number",
            LiteralValue::Bool(_) => "boolean",
            LiteralValue::Null => "null",
        }
    }

    pub(crate) fn to_value(&self) -> Value {
        match self {
            LiteralValue::Str(s) => Value::String(s.clone()),
            LiteralValue::Int(n) => json!(n),
            LiteralValue::Float(f) => json!(f),
            LiteralValue::Bool(b) => Value::Bool(*b),
            LiteralValue::Null => Value::Null,
        }
    }
}

/// A single path segment: identifier (field name), wildcard (`*`), or index
/// (numeric array index). The index value serializes as a number to match the JS
/// reference segment shape (`{type:'index', value:number}`).
#[derive(Debug, Clone, PartialEq)]
pub enum PathSegment {
    /// A named-field segment.
    Identifier(String),
    /// A wildcard (`*`) segment matching any array index.
    Wildcard,
    /// A segment written as a number; the path names the member that ECMAScript
    /// `String(number)` writes for it (CURP-028), so `1e3` names `1000`.
    Index(Number),
}

impl PathSegment {
    fn to_value(&self) -> Value {
        match self {
            PathSegment::Identifier(v) => json!({ "type": "identifier", "value": v }),
            PathSegment::Wildcard => json!({ "type": "wildcard" }),
            PathSegment::Index(i) => json!({ "type": "index", "value": i }),
        }
    }
}

/// An expression AST node (expressions.md §4).
#[derive(Debug, Clone, PartialEq)]
pub enum Node {
    /// `condition ? trueValue : falseValue` (right-associative).
    Ternary {
        /// The boolean condition.
        condition: Box<Node>,
        /// Branch evaluated when the condition is truthy.
        true_value: Box<Node>,
        /// Branch evaluated when the condition is falsy.
        false_value: Box<Node>,
    },
    /// Logical (`&& ||`) or comparison (`== != > >= < <=`) operation.
    Binary {
        /// The operator spelling.
        operator: String,
        /// Left operand.
        left: Box<Node>,
        /// Right operand.
        right: Box<Node>,
    },
    /// `! operand`.
    Unary {
        /// The operator spelling (`!`).
        operator: String,
        /// The negated operand.
        operand: Box<Node>,
    },
    /// `value [not] in list` membership test.
    In {
        /// Whether the test is negated (`not in`).
        negated: bool,
        /// The probed value.
        value: Box<Node>,
        /// Candidate Literal nodes.
        list: Vec<Node>,
    },
    /// A path reference.
    Path {
        /// `false` → resolved from the data root; `true` → relative to the field.
        relative: bool,
        /// Additional parent ascents beyond the current field's parent.
        levels_up: i64,
        /// Ordered path segments.
        segments: Vec<PathSegment>,
    },
    /// A literal value.
    Literal(LiteralValue),
    /// A parenthesized group wrapping an inner expression.
    Group(Box<Node>),
}

impl Node {
    /// Serialize to the canonical fixture AST shape (no `position`).
    pub fn to_value(&self) -> Value {
        match self {
            Node::Ternary {
                condition,
                true_value,
                false_value,
            } => json!({
                "type": "Ternary",
                "condition": condition.to_value(),
                "trueValue": true_value.to_value(),
                "falseValue": false_value.to_value(),
            }),
            Node::Binary {
                operator,
                left,
                right,
            } => json!({
                "type": "Binary",
                "operator": operator,
                "left": left.to_value(),
                "right": right.to_value(),
            }),
            Node::Unary { operator, operand } => json!({
                "type": "Unary",
                "operator": operator,
                "operand": operand.to_value(),
            }),
            Node::In {
                negated,
                value,
                list,
            } => json!({
                "type": "In",
                "negated": negated,
                "value": value.to_value(),
                "list": list.iter().map(Node::to_value).collect::<Vec<_>>(),
            }),
            Node::Path {
                relative,
                levels_up,
                segments,
            } => json!({
                "type": "Path",
                "relative": relative,
                "levelsUp": levels_up,
                "segments": segments.iter().map(PathSegment::to_value).collect::<Vec<_>>(),
            }),
            Node::Literal(lit) => json!({
                "type": "Literal",
                "valueType": lit.value_type(),
                "value": lit.to_value(),
            }),
            Node::Group(expr) => json!({
                "type": "Group",
                "expression": expr.to_value(),
            }),
        }
    }
}
