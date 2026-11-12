//! The pattern tree built from recognized tokens, and the pattern size.

use super::sets::CodeSet;
use super::syntax::Token;

/// The largest pattern size.
pub(crate) const SIZE_LIMIT: u64 = 1000;

/// A pattern tree node. Atoms refer to a set by index, so copies of one atom share it.
#[derive(Debug, Clone, PartialEq, Eq)]
pub(crate) enum Node {
    Atom(usize),
    Sequence(Vec<Node>),
    Alternation(Vec<Node>),
    Repeat {
        item: Box<Node>,
        min: u32,
        max: Option<u32>,
    },
}

impl Node {
    /// The size the specification defines: an atom is 1, a sequence or alternation
    /// the sum of its parts, a quantified item its size times its maximum, or times
    /// its minimum plus one when unbounded. Saturates instead of overflowing.
    pub(crate) fn size(&self) -> u64 {
        match self {
            Node::Atom(_) => 1,
            Node::Sequence(parts) | Node::Alternation(parts) => parts
                .iter()
                .fold(0u64, |total, part| total.saturating_add(part.size())),
            Node::Repeat { item, min, max } => {
                let times = match max {
                    Some(max) => u64::from(*max),
                    None => u64::from(*min) + 1,
                };
                item.size().saturating_mul(times)
            }
        }
    }
}

/// Build the tree and the sets of a recognized, balanced token sequence.
#[allow(
    clippy::expect_used,
    reason = "R-1: the recognizer passes only balanced tokens in which a quantifier follows an item"
)]
pub(crate) fn build(tokens: Vec<Token>) -> (Node, Vec<CodeSet>) {
    let mut sets = Vec::new();
    // Each open group (and the pattern) holds its finished alternatives and the
    // sequence being read.
    let mut stack: Vec<(Vec<Node>, Vec<Node>)> = vec![(Vec::new(), Vec::new())];
    for token in tokens {
        let (alternatives, sequence) = stack.last_mut().expect("the pattern frame");
        match token {
            Token::Atom(atom) => {
                sets.push(CodeSet::of_atom(&atom));
                sequence.push(Node::Atom(sets.len() - 1));
            }
            Token::Alternate => alternatives.push(Node::Sequence(std::mem::take(sequence))),
            Token::Quantifier { min, max } => {
                let item = sequence.pop().expect("a quantifier follows an item");
                sequence.push(Node::Repeat {
                    item: Box::new(item),
                    min,
                    max,
                });
            }
            Token::Open => stack.push((Vec::new(), Vec::new())),
            Token::Close => {
                let group = finish(stack.pop().expect("an open group"));
                stack.last_mut().expect("the enclosing frame").1.push(group);
            }
        }
    }
    let root = finish(stack.pop().expect("the pattern frame"));
    (root, sets)
}

fn finish((mut alternatives, sequence): (Vec<Node>, Vec<Node>)) -> Node {
    alternatives.push(Node::Sequence(sequence));
    Node::Alternation(alternatives)
}

#[cfg(test)]
mod tests {
    use super::super::recognizer::recognize;
    use super::*;

    fn size(source: &str) -> u64 {
        build(recognize(source).unwrap()).0.size()
    }

    #[test]
    fn sizes() {
        for (source, expected) in [
            ("a", 1),
            ("^$", 0),
            ("()", 0),
            ("a|bc", 3),
            ("[abc]\\p{L}.", 3),
            ("a*", 1),
            ("a+", 2),
            ("a?", 1),
            ("a{3,}", 4),
            ("a{2,5}", 5),
            ("a{0}", 0),
            ("((a{10})*){100}", 1000),
            ("(a{100}){20}", 2000),
            ("((a{10}){10}){11}", 1100),
            ("(?:a+){500}b", 1001),
            ("((){1000}){1000}", 0),
        ] {
            assert_eq!(size(source), expected, "{source}");
        }
        let deep = format!("{}a{}", "(".repeat(100), "){1000}".repeat(100));
        assert_eq!(size(&deep), u64::MAX);
    }
}
