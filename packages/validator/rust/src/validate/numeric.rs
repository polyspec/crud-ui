//! Numbers (validation rules, "Values"): numeric text, numeric values and exact
//! step multiples.

use serde_json::Value;

use super::canonical::decimal;
use super::whitespace::trim;

/// Whether `text` is numeric text, the HTML valid floating-point number:
/// `^-?(?:[0-9]+(?:\.[0-9]+)?|\.[0-9]+)(?:[eE][-+]?[0-9]+)?$`.
fn is_numeric_text(text: &str) -> bool {
    let digits = |part: &str| !part.is_empty() && part.bytes().all(|b| b.is_ascii_digit());
    // The sign is optional.
    let unsigned = match text.strip_prefix('-') {
        Some(rest) => rest,
        None => text,
    };
    let (mantissa, exponent) = match unsigned.split_once(['e', 'E']) {
        Some((mantissa, exponent)) => (mantissa, Some(exponent)),
        None => (unsigned, None),
    };
    let mantissa_ok = match mantissa.split_once('.') {
        Some((integer, fraction)) => (integer.is_empty() || digits(integer)) && digits(fraction),
        None => digits(mantissa),
    };
    let exponent_ok = exponent.is_none_or(|exponent| match exponent.strip_prefix(['-', '+']) {
        Some(rest) => digits(rest),
        None => digits(exponent),
    });
    mantissa_ok && exponent_ok
}

/// The value of numeric text (untrimmed): the nearest double, or `None` when the
/// text is not numeric text or its value overflows.
pub(crate) fn numeric_text_value(text: &str) -> Option<f64> {
    if !is_numeric_text(text) {
        return None;
    }
    // `is_numeric_text` admits only the grammar that Rust's `f64` parser reads.
    match text.parse::<f64>() {
        Ok(value) => value.is_finite().then_some(value),
        Err(_) => None,
    }
}

/// The value of a numeric value: a finite number, or a string that after trimming
/// is numeric text with a finite value. Other values are not numeric.
pub(crate) fn numeric_value(value: &Value) -> Option<f64> {
    match value {
        Value::Number(number) => number.as_f64().filter(|value| value.is_finite()),
        Value::String(text) => numeric_text_value(trim(text)),
        _ => None,
    }
}

/// The bounds of a `range` parameter: `[minimum, maximum]` finite numbers with the
/// minimum not above the maximum.
pub fn number_range(parameter: &Value) -> Option<(f64, f64)> {
    match parameter.as_array().map(Vec::as_slice) {
        Some([minimum, maximum]) => match (finite(minimum), finite(maximum)) {
            (Some(minimum), Some(maximum)) if minimum <= maximum => Some((minimum, maximum)),
            _ => None,
        },
        _ => None,
    }
}

/// The increment of a `step` parameter: a finite number above 0.
pub fn step(parameter: &Value) -> Option<f64> {
    finite(parameter).filter(|step| *step > 0.0)
}

/// A JSON number as a finite double.
fn finite(value: &Value) -> Option<f64> {
    value.as_f64().filter(|number| number.is_finite())
}

/// `(a · b) mod m` without overflow for `m < 2^64`.
#[allow(
    clippy::cast_possible_truncation,
    reason = "R-1: a remainder of a division by a u64 is below it, so it fits a u64"
)]
fn mul_mod(a: u64, b: u64, m: u64) -> u64 {
    ((u128::from(a) * u128::from(b)) % u128::from(m)) as u64
}

/// `10^exponent mod m`.
fn pow10_mod(mut exponent: u32, m: u64) -> u64 {
    let mut result = 1 % m;
    let mut base = 10 % m;
    while exponent > 0 {
        if exponent & 1 == 1 {
            result = mul_mod(result, base, m);
        }
        base = mul_mod(base, base, m);
        exponent >>= 1;
    }
    result
}

/// Whether finite `value` is an integer multiple of finite `step > 0`, both read
/// as the decimals their canonical texts write; decided exactly.
pub fn is_multiple(value: f64, step: f64) -> bool {
    let (a, p) = decimal(value);
    let (b, q) = decimal(step);
    if a == 0 {
        return true;
    }
    if p >= q {
        // a · 10^(p−q) mod b
        mul_mod(a % b, pow10_mod((p - q).unsigned_abs(), b), b) == 0
    } else {
        let shift = (q - p).unsigned_abs();
        // a < 10^17, so a larger shift leaves a fraction.
        match 10u64.checked_pow(shift) {
            Some(power) if a % power == 0 => (a / power) % b == 0,
            _ => false,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn numeric_text_grammar() {
        for text in [
            "0", "12", "-12", "0.5", ".5", "-.5", "1e5", "1E-3", "-.5e+2", "007", "1e999999",
        ] {
            assert!(is_numeric_text(text), "{text}");
        }
        for text in [
            "",
            "-",
            ".",
            "+1",
            "1.",
            "-.",
            "1.e5",
            "e5",
            "1e",
            "1e+",
            "--1",
            "0x10",
            "Infinity",
            "NaN",
            "1_000",
            "1,5",
            "1 2",
            " 1",
            "\u{661}\u{662}",
            "1.2.3",
            "1e5.0",
        ] {
            assert!(!is_numeric_text(text), "{text}");
        }
    }

    #[test]
    fn numeric_values() {
        assert_eq!(numeric_value(&json!(" 12\t")), Some(12.0));
        assert_eq!(numeric_value(&json!("1e-400")), Some(0.0));
        assert_eq!(numeric_value(&json!("1e999")), None);
        assert_eq!(numeric_value(&json!(1.5)), Some(1.5));
        for value in [json!(true), json!(null), json!(["1"]), json!({})] {
            assert_eq!(numeric_value(&value), None, "{value}");
        }
    }

    #[test]
    fn decimals_follow_the_canonical_text() {
        assert_eq!(decimal(0.0), (0, 0));
        assert_eq!(decimal(1.5), (15, -1));
        assert_eq!(decimal(100.0), (1, 2));
        assert_eq!(decimal(0.000001), (1, -6));
        assert_eq!(decimal(-2e-7), (2, -7));
        assert_eq!(decimal(1e21), (1, 21));
        assert_eq!(decimal(1.05e21), (105, 19));
        assert_eq!(decimal(123456789012345680000.0), (12345678901234568, 4));
    }

    #[test]
    fn multiples_are_exact() {
        for (value, step, expected) in [
            (0.0, 0.1, true),
            (0.3, 0.1, true),
            (0.1 + 0.2, 0.1, false),
            (2e-7, 0.1, false),
            (4e-7, 2e-7, true),
            (3e-7, 2e-7, false),
            (-15.0, 5.0, true),
            (1e21, 1e20, true),
            (1.05e21, 1e20, false),
            (1.0000000001, 0.1, false),
            (1e300, 3.0, false),
            (1e300, 7.0, false),
            (1.2e300, 3.0, true),
            (5e-324, 5e-324, true),
            (1e-300, 1e300, false),
            (0.75, 0.25, true),
            (
                123456789012345680000.0,
                7.0,
                123456789012345680000u128.is_multiple_of(7),
            ),
            (123456789012345680000.0, 8.0, true),
            (98765432109876540.0, 0.001, true),
        ] {
            assert_eq!(is_multiple(value, step), expected, "{value} / {step}");
        }
    }
}
