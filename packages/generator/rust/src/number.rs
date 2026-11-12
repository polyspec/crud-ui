use num_bigint::BigUint;
use num_traits::ToPrimitive;

fn whitespace(character: char) -> bool {
    matches!(character, '\u{0009}'..='\u{000d}' | '\u{0020}' | '\u{00a0}' | '\u{1680}'
        | '\u{2000}'..='\u{200a}' | '\u{2028}' | '\u{2029}' | '\u{202f}'
        | '\u{205f}' | '\u{3000}' | '\u{feff}')
}

fn radix_number(digits: &str, radix: u32) -> Option<f64> {
    if digits.is_empty()
        || !digits
            .bytes()
            .all(|digit| digit.is_ascii() && (digit as char).is_digit(radix))
    {
        return None;
    }
    BigUint::parse_bytes(digits.as_bytes(), radix)?.to_f64()
}

pub(crate) fn parse(source: &str) -> Option<f64> {
    let source = source.trim_matches(whitespace);
    if source.is_empty() {
        Some(0.0)
    } else if source.starts_with("0x") || source.starts_with("0X") {
        radix_number(&source[2..], 16)
    } else if source.starts_with("0o") || source.starts_with("0O") {
        radix_number(&source[2..], 8)
    } else if source.starts_with("0b") || source.starts_with("0B") {
        radix_number(&source[2..], 2)
    } else {
        decimal(source)
    }
}

/// A decimal number text; a text that is no number is `None`, as the JS reference reads it (NaN).
#[allow(
    clippy::disallowed_methods,
    reason = "the JS reference reads a non-number as NaN"
)]
fn decimal(source: &str) -> Option<f64> {
    source.parse::<f64>().ok()
}
