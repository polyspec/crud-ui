//! Length rules `minlength`, `maxlength` and `rangelength` (validation rules,
//! "Values"): the code points of a scalar's canonical text, untrimmed.

use serde_json::Value;

use super::canonical::canonical_text;

/// The largest length limit (ECMAScript `Number.MAX_SAFE_INTEGER`).
pub(crate) const MAX_LIMIT: u64 = 9_007_199_254_740_991;

/// A limit: an integer from 0 to [`MAX_LIMIT`], or `None`.
pub(crate) fn limit(value: &Value) -> Option<u64> {
    let number = value.as_number()?;
    if let Some(unsigned) = number.as_u64() {
        return (unsigned <= MAX_LIMIT).then_some(unsigned);
    }
    if number.is_i64() {
        // A negative integer.
        return None;
    }
    let float = number.as_f64()?;
    // `-0.0 >= 0.0` holds, so negative zero is the limit 0.
    #[allow(
        clippy::cast_possible_truncation,
        clippy::cast_sign_loss,
        reason = "R-1: the value is an integer from 0 to 2^53 - 1, which a u64 holds exactly"
    )]
    let limit =
        (float.fract() == 0.0 && (0.0..=MAX_LIMIT as f64).contains(&float)).then_some(float as u64);
    limit
}

/// A `rangelength` parameter: `[minimum, maximum]` limits with minimum ≤ maximum.
pub(crate) fn range_limits(value: &Value) -> Option<(u64, u64)> {
    match value.as_array().map(Vec::as_slice) {
        Some([minimum, maximum]) => {
            let (minimum, maximum) = (limit(minimum)?, limit(maximum)?);
            (minimum <= maximum).then_some((minimum, maximum))
        }
        _ => None,
    }
}

/// The length of a nonempty value: the code-point count of its canonical text, or
/// `None` for an array or object, which fails every length rule.
pub(crate) fn value_length(value: &Value) -> Option<u64> {
    canonical_text(value).map(|text| text.chars().count() as u64)
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn limits_are_safe_nonnegative_integers() {
        for (value, expected) in [
            (json!(0), Some(0)),
            (json!(-0.0), Some(0)),
            (json!(5), Some(5)),
            (json!(5.0), Some(5)),
            (json!(9007199254740991u64), Some(MAX_LIMIT)),
            (json!(9007199254740992u64), None),
            (json!(9007199254740992.0), None),
            (json!(1e300), None),
            (json!(-1), None),
            (json!(1.5), None),
            (json!("5"), None),
            (json!(true), None),
            (json!(null), None),
            (json!([5]), None),
        ] {
            assert_eq!(limit(&value), expected, "{value}");
        }
    }

    #[test]
    fn range_limits_are_ordered() {
        assert_eq!(range_limits(&json!([2, 3])), Some((2, 3)));
        assert_eq!(range_limits(&json!([3, 3])), Some((3, 3)));
        for value in [
            json!([3, 2]),
            json!([1, 2.5]),
            json!([1]),
            json!([1, 2, 3]),
            json!({ "0": 1, "1": 2 }),
            json!("1,2"),
        ] {
            assert_eq!(range_limits(&value), None, "{value}");
        }
    }

    #[test]
    fn lengths_count_code_points_of_canonical_text() {
        for (value, expected) in [
            (json!(12), Some(2)),
            (json!(1.5), Some(3)),
            (json!(1e21), Some(5)),
            (json!(true), Some(1)),
            (json!("\u{1F468}\u{200D}\u{1F469}"), Some(3)),
            (json!("e\u{301}"), Some(2)),
            (json!(" x "), Some(3)),
            (json!(["a"]), None),
            (json!({ "a": 1 }), None),
        ] {
            assert_eq!(value_length(&value), expected, "{value}");
        }
    }
}
