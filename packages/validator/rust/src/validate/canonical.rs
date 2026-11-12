//! Canonical text of a scalar (validation rules, "Values").
//!
//! A string is itself, `true` is `1`, `false` is `0`, and a finite number is written
//! as ECMAScript `Number.prototype.toString` writes it. JSON integers are read as
//! the double that ECMAScript would read (CURP-028).

use std::borrow::Cow;

use serde_json::{Number, Value};

/// The double that ECMAScript's `JSON.parse` reads for a JSON number (CURP-028).
///
/// `serde_json` keeps an integer token as an `i64` or a `u64`; its conversion to `f64`
/// rounds to the nearest double with ties to even, as ECMAScript reads the token, so
/// `9007199254740993` is `9007199254740992`.
#[allow(
    clippy::manual_unwrap_or,
    reason = "R-1: without arbitrary_precision every serde_json number has an f64; the NaN arm is unreachable"
)]
pub fn json_number(number: &Number) -> f64 {
    match number.as_f64() {
        Some(value) => value,
        // `as_f64` has no value only for a number that `serde_json`'s `arbitrary_precision`
        // feature keeps as text, which this crate does not enable; such a number has no double.
        None => f64::NAN,
    }
}

/// The canonical text of a scalar (CUVR-021); `None` for `null`, arrays and objects.
pub fn canonical_text(value: &Value) -> Option<Cow<'_, str>> {
    match value {
        Value::String(text) => Some(Cow::Borrowed(text)),
        Value::Bool(true) => Some(Cow::Borrowed("1")),
        Value::Bool(false) => Some(Cow::Borrowed("0")),
        Value::Number(number) => Some(Cow::Owned(number_text(json_number(number)))),
        Value::Null | Value::Array(_) | Value::Object(_) => None,
    }
}

/// ECMAScript `Number::toString(x)` with radix 10 (`NaN`, `Infinity` and
/// `-Infinity` for nonfinite values, which JSON values never are).
///
/// ECMAScript takes the fewest significant digits k whose decimal reads back as
/// `x` and, among such k-digit decimals, the one closest to `x`, an exact tie going
/// to the even one. Rust's `{:e}` writes the fewest digits but may break a tie the
/// other way (2^-25 is exactly 2.98023223876953125e-8; ECMAScript writes
/// …312e-8, `{:e}` writes …313e-8). The k-digit decimal closest to `x` is the
/// correctly rounded one, which `{:.*e}` writes with ties to even; when that one
/// does not read back as `x` (possible just above a power of two), the shortest
/// output is the only k-digit decimal that does.
pub fn number_text(x: f64) -> String {
    if x.is_nan() {
        return "NaN".to_string();
    }
    if x.is_infinite() {
        return if x > 0.0 { "Infinity" } else { "-Infinity" }.to_string();
    }
    if x == 0.0 {
        // Covers negative zero.
        return "0".to_string();
    }
    let sign = if x < 0.0 { "-" } else { "" };
    let (digits, n) = shortest_digits(x.abs());
    let k = digit_count(&digits);
    let digits: String = digits
        .iter()
        .map(|digit| char::from(b'0' + digit))
        .collect();

    let body = if k <= n && n <= 21 {
        format!("{digits}{}", "0".repeat(span(n - k)))
    } else if 0 < n && n <= 21 {
        let (int, frac) = digits.split_at(span(n));
        format!("{int}.{frac}")
    } else if -6 < n && n <= 0 {
        format!("0.{}{digits}", "0".repeat(span(-n)))
    } else {
        let e = n - 1;
        let e_sign = if e >= 0 { '+' } else { '-' };
        let (first, rest) = digits.split_at(1);
        if rest.is_empty() {
            format!("{first}e{e_sign}{}", e.abs())
        } else {
            format!("{first}.{rest}e{e_sign}{}", e.abs())
        }
    };
    format!("{sign}{body}")
}

/// A finite nonzero double as the decimal its canonical text writes: `significand × 10^exponent`,
/// and `(0, 0)` for zero.
pub(crate) fn decimal(value: f64) -> (u64, i32) {
    if value == 0.0 || !value.is_finite() {
        return (0, 0);
    }
    let (digits, n) = shortest_digits(value.abs());
    // At most 17 digits, so the significand fits in a u64.
    let significand = digits.iter().fold(0u64, |significand, digit| {
        significand * 10 + u64::from(*digit)
    });
    (significand, n - digit_count(&digits))
}

/// The digits `d1…dk` and the exponent `n` with `x = 0.d1…dk × 10^n` that ECMAScript
/// `Number::toString` chooses for a finite positive double (see [`number_text`]).
fn shortest_digits(magnitude: f64) -> (Vec<u8>, i32) {
    let shortest = format!("{magnitude:e}");
    let count = shortest
        .bytes()
        .take_while(|byte| *byte != b'e')
        .filter(u8::is_ascii_digit)
        .count();
    let rounded = format!("{magnitude:.*e}", count.saturating_sub(1));
    let scientific = if rounded.parse::<f64>() == Ok(magnitude) {
        rounded
    } else {
        shortest
    };
    // `{:e}` writes the digits, an optional point, `e`, an optional `-` and the decimal exponent.
    let mut digits = Vec::new();
    let mut exponent: i32 = 0;
    let mut negative = false;
    let mut in_exponent = false;
    for byte in scientific.bytes() {
        match byte {
            b'e' => in_exponent = true,
            b'-' => negative = true,
            b'0'..=b'9' if in_exponent => exponent = exponent * 10 + i32::from(byte - b'0'),
            b'0'..=b'9' => digits.push(byte - b'0'),
            _ => {}
        }
    }
    let exponent = if negative { -exponent } else { exponent };
    (digits, exponent + 1)
}

/// The number of digits of a double's shortest decimal, at most 17.
#[allow(
    clippy::cast_possible_truncation,
    clippy::cast_possible_wrap,
    reason = "R-1: a double has at most 17 significant digits"
)]
fn digit_count(digits: &[u8]) -> i32 {
    digits.len() as i32
}

/// A count of characters that a branch of [`number_text`] has checked to be nonnegative.
fn span(count: i32) -> usize {
    // u32 to usize is lossless on every target of the crate.
    count.unsigned_abs() as usize
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn numbers_as_ecmascript_writes_them() {
        let cases: &[(f64, &str)] = &[
            (0.0, "0"),
            (-0.0, "0"),
            (1.0, "1"),
            (-1.0, "-1"),
            (12.0, "12"),
            (1.5, "1.5"),
            (-1.5, "-1.5"),
            (100.0, "100"),
            (0.1, "0.1"),
            (0.1 + 0.2, "0.30000000000000004"),
            (1.0 / 3.0, "0.3333333333333333"),
            (2.0 / 3.0, "0.6666666666666666"),
            (4.35, "4.35"),
            (123.456, "123.456"),
            (0.000001, "0.000001"),
            (0.0000012, "0.0000012"),
            (1e-7, "1e-7"),
            (5e-7, "5e-7"),
            (1.23e-18, "1.23e-18"),
            (-1.5e-7, "-1.5e-7"),
            (1e21, "1e+21"),
            (1.5e21, "1.5e+21"),
            (-1e21, "-1e+21"),
            (1e20, "100000000000000000000"),
            (123456789012345680000.0, "123456789012345680000"),
            (999999999999999900000.0, "999999999999999900000"),
            (1180591620717411303424.0, "1.1805916207174113e+21"),
            (9007199254740991.0, "9007199254740991"),
            (9007199254740992.0, "9007199254740992"),
            (18446744073709551615.0, "18446744073709552000"),
            (-9223372036854775808.0, "-9223372036854776000"),
            (1e100, "1e+100"),
            (f64::MAX, "1.7976931348623157e+308"),
            (f64::MIN_POSITIVE, "2.2250738585072014e-308"),
            (5e-324, "5e-324"),
            (-5e-324, "-5e-324"),
            (2.5e-6, "0.0000025"),
            (1e-6, "0.000001"),
            (
                f64::from_bits(0x3EB0_C6F7_A0B5_ED8C),
                "9.999999999999997e-7",
            ),
            (0.5, "0.5"),
            (1234.5678, "1234.5678"),
            (1e15, "1000000000000000"),
            (1.7976931348623157e300, "1.7976931348623156e+300"),
            (5e-8, "5e-8"),
            (1.0000000000000002, "1.0000000000000002"),
            (100.25, "100.25"),
            (f64::INFINITY, "Infinity"),
            (f64::NEG_INFINITY, "-Infinity"),
            (f64::NAN, "NaN"),
        ];
        for (value, text) in cases {
            assert_eq!(number_text(*value), *text, "{value:?}");
        }
    }

    /// `tests/data/number-text.tsv` pairs double bit patterns with the text
    /// ECMAScript writes for them; `tools/generate-number-text.mjs` writes it.
    #[test]
    fn numbers_match_the_ecmascript_table() {
        let path = concat!(env!("CARGO_MANIFEST_DIR"), "/tests/data/number-text.tsv");
        let table = match std::fs::read_to_string(path) {
            Ok(table) => table,
            Err(error) => panic!("read {path}: {error}"),
        };
        let mut count = 0;
        for line in table.lines() {
            let (bits, text) = line.split_once('\t').expect("a tab-separated row");
            let value = f64::from_bits(u64::from_str_radix(bits, 16).expect("hexadecimal bits"));
            assert_eq!(number_text(value), text, "{bits} ({value:e})");
            count += 1;
        }
        assert!(count >= 10_000, "the table has {count} rows");
    }

    #[test]
    fn scalars_and_json_numbers() {
        let text = |value: Value| canonical_text(&value).map(|t| t.into_owned());
        assert_eq!(text(json!("  a ")).as_deref(), Some("  a "));
        assert_eq!(text(json!(true)).as_deref(), Some("1"));
        assert_eq!(text(json!(false)).as_deref(), Some("0"));
        assert_eq!(text(json!(12)).as_deref(), Some("12"));
        assert_eq!(text(json!(-7)).as_deref(), Some("-7"));
        assert_eq!(
            text(json!(u64::MAX)).as_deref(),
            Some("18446744073709552000")
        );
        assert_eq!(
            text(json!(i64::MIN)).as_deref(),
            Some("-9223372036854776000")
        );
        assert_eq!(
            text(json!(9007199254740993u64)).as_deref(),
            Some("9007199254740992")
        );
        assert_eq!(text(json!(null)), None);
        assert_eq!(text(json!([1])), None);
        assert_eq!(text(json!({})), None);
    }

    #[test]
    fn json_text_reads_as_the_nearest_double() {
        for (source, text) in [
            ("0.30000000000000004", "0.30000000000000004"),
            ("123456789012345680000", "123456789012345680000"),
            ("1e21", "1e+21"),
            ("-0", "0"),
            ("-0.0", "0"),
            ("2.2250738585072011e-308", "2.225073858507201e-308"),
            ("9007199254740993.0", "9007199254740992"),
            ("0.1e1", "1"),
        ] {
            let value: Value = serde_json::from_str(source).unwrap();
            assert_eq!(canonical_text(&value).unwrap(), text, "{source}");
        }
    }
}
