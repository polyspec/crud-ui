//! Recognizer of the CRUDUI pattern language (validation rules, "Patterns" and
//! "Parameter errors").
//!
//! It reads the pattern left to right and reports the first construct outside the
//! language with its reason and code-point offset. The pattern size is checked
//! later, once the whole pattern is otherwise valid.

use std::collections::HashSet;

use crate::validate::unicode::{lookup, GENERAL_CATEGORIES, SCRIPTS};

use super::syntax::{Atom, ClassItem, PatternError, Property, Reason, Shorthand, Token};

/// The largest quantifier bound.
const BOUND_LIMIT: u64 = 1000;

/// The deepest group nesting.
const DEPTH_LIMIT: usize = 100;

/// Characters that `\` makes literal.
const ESCAPABLE: &[char] = &[
    '^', '$', '\\', '.', '*', '+', '?', '(', ')', '[', ']', '{', '}', '|', '/', '-',
];

/// Recognize `source`, returning its tokens or the first construct outside the language.
pub(crate) fn recognize(source: &str) -> Result<Vec<Token>, PatternError> {
    Recognizer {
        chars: source.chars().collect(),
        pos: 0,
        tokens: Vec::new(),
        names: HashSet::new(),
    }
    .run()
}

struct Recognizer {
    chars: Vec<char>,
    pos: usize,
    tokens: Vec<Token>,
    names: HashSet<String>,
}

fn error(reason: Reason, offset: usize) -> PatternError {
    PatternError { reason, offset }
}

fn is_quantifier_start(c: char) -> bool {
    matches!(c, '*' | '+' | '?' | '{')
}

impl Recognizer {
    fn peek(&self) -> Option<char> {
        self.chars.get(self.pos).copied()
    }

    fn peek_at(&self, offset: usize) -> Option<char> {
        self.chars.get(self.pos + offset).copied()
    }

    fn run(mut self) -> Result<Vec<Token>, PatternError> {
        let len = self.chars.len();
        if len == 0 {
            return Err(error(Reason::EmptyPattern, 0));
        }
        // The number of open groups.
        let mut depth = 0usize;
        while let Some(c) = self.peek() {
            let start = self.pos;
            // Whether the construct just read is an atom or group a quantifier may follow.
            let quantifiable = match c {
                '^' if start == 0 => {
                    self.pos += 1;
                    false
                }
                '$' if start == len - 1 => {
                    self.pos += 1;
                    false
                }
                '^' | '$' | ']' | '}' => return Err(error(Reason::UnexpectedCharacter, start)),
                '|' => {
                    self.pos += 1;
                    self.tokens.push(Token::Alternate);
                    false
                }
                '(' => {
                    if depth == DEPTH_LIMIT {
                        return Err(error(Reason::NestingTooDeep, start));
                    }
                    self.open_group()?;
                    depth += 1;
                    false
                }
                ')' => {
                    if depth == 0 {
                        return Err(error(Reason::UnexpectedCharacter, start));
                    }
                    self.pos += 1;
                    self.tokens.push(Token::Close);
                    depth -= 1;
                    true
                }
                c if is_quantifier_start(c) => {
                    return Err(error(Reason::InvalidQuantifier, start));
                }
                '[' => {
                    let atom = self.class()?;
                    self.atom(atom)
                }
                '.' => {
                    self.pos += 1;
                    self.atom(Atom::Any)
                }
                '\\' => {
                    let atom = self.escape()?;
                    self.atom(atom)
                }
                c => {
                    self.pos += 1;
                    self.atom(Atom::Literal(c))
                }
            };
            if quantifiable {
                self.quantifier()?;
            }
        }
        if depth > 0 {
            return Err(error(Reason::UnterminatedGroup, len));
        }
        Ok(self.tokens)
    }

    fn atom(&mut self, atom: Atom) -> bool {
        self.tokens.push(Token::Atom(atom));
        true
    }

    /// An optional quantifier, with an optional lazy `?` that changes nothing for a
    /// whole match.
    fn quantifier(&mut self) -> Result<(), PatternError> {
        let (min, max) = match self.peek() {
            Some('{') => self.braces()?,
            Some(c @ ('*' | '+' | '?')) => {
                self.pos += 1;
                match c {
                    '*' => (0, None),
                    '+' => (1, None),
                    _ => (0, Some(1)),
                }
            }
            _ => return Ok(()),
        };
        if self.peek() == Some('?') {
            self.pos += 1;
        }
        if let Some(c) = self.peek() {
            if is_quantifier_start(c) {
                return Err(error(Reason::InvalidQuantifier, self.pos));
            }
        }
        self.tokens.push(Token::Quantifier { min, max });
        Ok(())
    }

    /// `{n}`, `{n,}` or `{n,m}` with n ≤ m ≤ 1000.
    fn braces(&mut self) -> Result<(u32, Option<u32>), PatternError> {
        let start = self.pos;
        let invalid = error(Reason::InvalidQuantifier, start);
        self.pos += 1;
        let min = self.number().ok_or(invalid)?;
        let max = match self.peek() {
            Some('}') => Some(min),
            Some(',') => {
                self.pos += 1;
                if self.peek() == Some('}') {
                    None
                } else {
                    Some(self.number().ok_or(invalid)?)
                }
            }
            _ => return Err(invalid),
        };
        if self.peek() != Some('}') {
            return Err(invalid);
        }
        self.pos += 1;
        if min > BOUND_LIMIT || max.is_some_and(|max| max > BOUND_LIMIT || max < min) {
            return Err(invalid);
        }
        #[allow(
            clippy::cast_possible_truncation,
            reason = "R-1: both bounds are at most 1000 here"
        )]
        let bounds = (min as u32, max.map(|max| max as u32));
        Ok(bounds)
    }

    /// One or more decimal digits.
    fn number(&mut self) -> Option<u64> {
        let start = self.pos;
        let mut value: u64 = 0;
        while let Some(digit) = self.peek().and_then(|c| c.to_digit(10)) {
            value = value.saturating_mul(10).saturating_add(u64::from(digit));
            self.pos += 1;
        }
        (self.pos > start).then_some(value)
    }

    /// `(…)`, `(?:…)` or `(?<name>…)`; pushes the open token.
    fn open_group(&mut self) -> Result<(), PatternError> {
        let start = self.pos;
        self.pos += 1;
        if self.peek() == Some('?') {
            match (self.peek_at(1), self.peek_at(2)) {
                (Some(':'), _) => self.pos += 2,
                (Some('<'), next) if !matches!(next, Some('=') | Some('!')) => {
                    self.pos += 2;
                    let name_start = self.pos;
                    while self.peek().is_some_and(|c| c != '>') {
                        self.pos += 1;
                    }
                    if self.peek().is_none() {
                        return Err(error(Reason::InvalidGroupName, start));
                    }
                    let name: String = self.chars[name_start..self.pos].iter().collect();
                    self.pos += 1;
                    if !is_group_name(&name) {
                        return Err(error(Reason::InvalidGroupName, start));
                    }
                    if !self.names.insert(name) {
                        return Err(error(Reason::DuplicateGroupName, start));
                    }
                }
                _ => return Err(error(Reason::UnsupportedConstruct, start)),
            }
        }
        self.tokens.push(Token::Open);
        Ok(())
    }

    /// An escape outside a bracket class.
    fn escape(&mut self) -> Result<Atom, PatternError> {
        match self.peek_at(1) {
            Some(c @ ('d' | 'w' | 's' | 'D' | 'W' | 'S')) => {
                self.pos += 2;
                Ok(Atom::Shorthand {
                    set: shorthand(c),
                    negated: c.is_ascii_uppercase(),
                })
            }
            Some('p' | 'P') => self.property().map(Atom::Property),
            _ => self.literal_escape().map(Atom::Literal),
        }
    }

    /// A literal, control, `\xHH` or `\u{H…}` escape at the current position.
    fn literal_escape(&mut self) -> Result<char, PatternError> {
        let start = self.pos;
        let invalid = error(Reason::InvalidEscape, start);
        let c = self.peek_at(1).ok_or(invalid)?;
        self.pos += 2;
        match c {
            c if ESCAPABLE.contains(&c) => Ok(c),
            't' => Ok('\t'),
            'n' => Ok('\n'),
            'r' => Ok('\r'),
            'f' => Ok('\u{C}'),
            'v' => Ok('\u{B}'),
            'x' => {
                let high = self.peek().and_then(|c| c.to_digit(16)).ok_or(invalid)?;
                let low = self
                    .peek_at(1)
                    .and_then(|c| c.to_digit(16))
                    .ok_or(invalid)?;
                self.pos += 2;
                char::from_u32(high * 16 + low).ok_or(invalid)
            }
            'u' => {
                if self.peek() != Some('{') {
                    return Err(invalid);
                }
                self.pos += 1;
                let mut value: u32 = 0;
                let mut count = 0;
                while let Some(digit) = self.peek().and_then(|c| c.to_digit(16)) {
                    count += 1;
                    if count > 6 {
                        return Err(invalid);
                    }
                    value = value * 16 + digit;
                    self.pos += 1;
                }
                if count == 0 || self.peek() != Some('}') {
                    return Err(invalid);
                }
                self.pos += 1;
                char::from_u32(value).ok_or(invalid)
            }
            _ => Err(invalid),
        }
    }

    /// `\p{X}`, `\P{X}`, `\p{Script=Name}` or `\P{Script=Name}` at the current position.
    fn property(&mut self) -> Result<Property, PatternError> {
        let start = self.pos;
        let invalid = error(Reason::InvalidProperty, start);
        let negated = self.peek_at(1) == Some('P');
        if self.peek_at(2) != Some('{') {
            return Err(invalid);
        }
        self.pos += 3;
        let name_start = self.pos;
        while self.peek().is_some_and(|c| c != '}') {
            self.pos += 1;
        }
        if self.peek().is_none() {
            return Err(invalid);
        }
        let name: String = self.chars[name_start..self.pos].iter().collect();
        self.pos += 1;
        let ranges = match name.strip_prefix("Script=") {
            Some(script) => lookup(SCRIPTS, script),
            None => lookup(GENERAL_CATEGORIES, &name),
        }
        .ok_or(invalid)?;
        Ok(Property { negated, ranges })
    }

    /// `[…]` or `[^…]`.
    fn class(&mut self) -> Result<Atom, PatternError> {
        let start = self.pos;
        let len = self.chars.len();
        self.pos += 1;
        let negated = self.peek() == Some('^');
        if negated {
            self.pos += 1;
        }
        let mut items: Vec<ClassItem> = Vec::new();
        loop {
            let item_start = self.pos;
            let item = match self.peek() {
                None => return Err(error(Reason::UnterminatedClass, len)),
                Some(']') if items.is_empty() => return Err(error(Reason::InvalidClass, start)),
                Some(']') => {
                    self.pos += 1;
                    return Ok(Atom::Class { negated, items });
                }
                // A boundary `-` is a literal: first, or last before `]`.
                Some('-') if items.is_empty() || self.peek_at(1) == Some(']') => {
                    self.pos += 1;
                    ClassItem::Char('-')
                }
                _ => self.class_member(start)?,
            };
            // A non-boundary `-` after a member makes a range.
            if self.peek() == Some('-') && !matches!(self.peek_at(1), Some(']') | None) {
                self.pos += 1;
                let end = self.class_member(start)?;
                match (item, end) {
                    (ClassItem::Char(low), ClassItem::Char(high)) if low <= high => {
                        items.push(ClassItem::Range(low, high));
                    }
                    _ => return Err(error(Reason::InvalidRange, item_start)),
                }
                // A `-` after a range is neither at a boundary nor a range operator.
                if self.peek() == Some('-') && !matches!(self.peek_at(1), Some(']') | None) {
                    return Err(error(Reason::InvalidClass, start));
                }
            } else {
                items.push(item);
            }
        }
    }

    /// One class member or range endpoint; `class_start` locates class errors.
    fn class_member(&mut self, class_start: usize) -> Result<ClassItem, PatternError> {
        match self.peek() {
            Some('[') => Err(error(Reason::InvalidClass, class_start)),
            Some('\\') => match self.peek_at(1) {
                Some('D' | 'W' | 'S') => Err(error(Reason::InvalidClass, class_start)),
                Some(c @ ('d' | 'w' | 's')) => {
                    self.pos += 2;
                    Ok(ClassItem::Shorthand(shorthand(c)))
                }
                Some('p' | 'P') => self.property().map(ClassItem::Property),
                _ => self.literal_escape().map(ClassItem::Char),
            },
            Some(c) => {
                self.pos += 1;
                Ok(ClassItem::Char(c))
            }
            None => Err(error(Reason::UnterminatedClass, self.chars.len())),
        }
    }
}

fn shorthand(c: char) -> Shorthand {
    match c.to_ascii_lowercase() {
        'd' => Shorthand::Digit,
        'w' => Shorthand::Word,
        _ => Shorthand::Space,
    }
}

/// `[A-Za-z_][A-Za-z0-9_]*`
fn is_group_name(name: &str) -> bool {
    let mut chars = name.chars();
    chars
        .next()
        .is_some_and(|c| c.is_ascii_alphabetic() || c == '_')
        && chars.all(|c| c.is_ascii_alphanumeric() || c == '_')
}
