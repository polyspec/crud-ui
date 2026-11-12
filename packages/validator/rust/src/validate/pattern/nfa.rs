//! Thompson NFA for a pattern tree, and the whole-text matcher.
//!
//! Matching simulates every state at once: time is proportional to the text
//! length times the number of states, memory to the number of states. Nothing
//! recurses on the text; the epsilon closure uses an explicit stack.

use super::sets::CodeSet;
use super::tree::Node;

/// An NFA state; `usize` fields are state indexes.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum State {
    /// Consume a code point in the set, then continue.
    Char {
        set: usize,
        next: usize,
    },
    Split(usize, usize),
    Epsilon(usize),
    Match,
}

/// A compiled pattern.
#[derive(Debug)]
pub(crate) struct Program {
    states: Vec<State>,
    start: usize,
    sets: Vec<CodeSet>,
}

impl Program {
    /// Compile a tree whose atoms index `sets`.
    pub(crate) fn new(root: &Node, sets: Vec<CodeSet>) -> Self {
        let mut compiler = Compiler { states: Vec::new() };
        let accept = compiler.push(State::Match);
        let start = compiler.compile(root, accept);
        Program {
            states: compiler.states,
            start,
            sets,
        }
    }

    /// The number of states.
    #[cfg(test)]
    pub(crate) fn len(&self) -> usize {
        self.states.len()
    }

    /// Whether the whole of `text` matches.
    pub(crate) fn is_match(&self, text: &str) -> bool {
        let mut run = Run {
            program: self,
            marks: vec![0; self.states.len()],
            generation: 1,
            stack: Vec::new(),
        };
        let mut current = Vec::new();
        run.close(self.start, &mut current);
        let mut next = Vec::new();
        // Per-set membership for the current code point: (generation, member).
        let mut membership: Vec<(u64, bool)> = vec![(0, false); self.sets.len()];
        for c in text.chars() {
            run.generation += 1;
            let generation = run.generation;
            next.clear();
            for &state in &current {
                if let State::Char { set, next: to } = self.states[state] {
                    let (seen, member) = &mut membership[set];
                    if *seen != generation {
                        *seen = generation;
                        *member = self.sets[set].contains(c);
                    }
                    if *member {
                        run.close(to, &mut next);
                    }
                }
            }
            std::mem::swap(&mut current, &mut next);
            if current.is_empty() {
                return false;
            }
        }
        current
            .iter()
            .any(|&state| self.states[state] == State::Match)
    }
}

/// The state of one match.
struct Run<'a> {
    program: &'a Program,
    /// The generation in which each state was last added.
    marks: Vec<u64>,
    generation: u64,
    stack: Vec<usize>,
}

impl Run<'_> {
    /// Add the epsilon closure of `state` to `list`, keeping only states that
    /// consume a code point or accept.
    fn close(&mut self, state: usize, list: &mut Vec<usize>) {
        self.stack.push(state);
        while let Some(state) = self.stack.pop() {
            if self.marks[state] == self.generation {
                continue;
            }
            self.marks[state] = self.generation;
            match self.program.states[state] {
                State::Char { .. } | State::Match => list.push(state),
                State::Epsilon(next) => self.stack.push(next),
                State::Split(first, second) => {
                    self.stack.push(second);
                    self.stack.push(first);
                }
            }
        }
    }
}

struct Compiler {
    states: Vec<State>,
}

impl Compiler {
    fn push(&mut self, state: State) -> usize {
        self.states.push(state);
        self.states.len() - 1
    }

    /// Compile `node` so that it continues to `next`; returns its entry state.
    /// A node of size 0 can only match empty text and becomes one epsilon.
    fn compile(&mut self, node: &Node, next: usize) -> usize {
        if node.size() == 0 {
            return self.push(State::Epsilon(next));
        }
        match node {
            Node::Atom(set) => self.push(State::Char { set: *set, next }),
            Node::Sequence(parts) => parts
                .iter()
                .rev()
                .filter(|part| part.size() > 0)
                .fold(next, |entry, part| self.compile(part, entry)),
            Node::Alternation(alternatives) => {
                let mut entries: Vec<usize> = alternatives
                    .iter()
                    .filter(|alternative| alternative.size() > 0)
                    .map(|alternative| self.compile(alternative, next))
                    .collect();
                if entries.len() < alternatives.len() {
                    // Every empty alternative matches only empty text.
                    entries.push(self.push(State::Epsilon(next)));
                }
                #[allow(
                    clippy::expect_used,
                    reason = "R-1: an alternation has an alternative of positive size or the empty one pushed above"
                )]
                let last = entries.pop().expect("an alternative of positive size");
                entries
                    .into_iter()
                    .rev()
                    .fold(last, |rest, entry| self.push(State::Split(entry, rest)))
            }
            Node::Repeat { item, min, max } => {
                let mut entry = match max {
                    None => {
                        // One loop: the item repeats any number of times.
                        let split = self.push(State::Split(0, next));
                        let body = self.compile(item, split);
                        self.states[split] = State::Split(body, next);
                        split
                    }
                    Some(max) => {
                        // (max − min) nested optional copies.
                        let mut entry = next;
                        for _ in *min..*max {
                            let body = self.compile(item, entry);
                            entry = self.push(State::Split(body, next));
                        }
                        entry
                    }
                };
                for _ in 0..*min {
                    entry = self.compile(item, entry);
                }
                entry
            }
        }
    }
}
