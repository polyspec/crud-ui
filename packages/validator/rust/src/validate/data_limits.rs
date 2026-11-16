//! The data limits of a form root (validation rules, "Data limits").

use serde_json::Value;

use super::errors::FormInputError;
use super::length::limit;
use crate::compose::{ComposeErrorCode, ComposeLoadError};
use crate::text::{NESTING_LIMIT, NODE_LIMIT};

/// The bounds of the submitted data: its levels and its nodes.
pub(crate) struct DataLimits {
    depth: u64,
    values: u64,
}

/// The limits of a form root that declares none (CUVR-083).
const DEFAULT_LIMITS: DataLimits = DataLimits {
    depth: 64,
    values: 100_000,
};

/// The load failure of a bad `dataLimits` (CUVR-084).
fn bad_limits() -> ComposeLoadError {
    ComposeLoadError::new(
        ComposeErrorCode::InvalidRuleParameter,
        format!(
            "Invalid dataLimits parameter: expected depth from 1 to {NESTING_LIMIT} and values from 1 to {NODE_LIMIT}"
        ),
    )
}

/// The `dataLimits` of a form root, a missing member taking its default.
pub(crate) fn data_limits(root: &Value) -> Result<DataLimits, ComposeLoadError> {
    let mut limits = DEFAULT_LIMITS;
    let Some(declared) = root.get("dataLimits") else {
        return Ok(limits);
    };
    for (key, value) in declared.as_object().ok_or_else(bad_limits)? {
        let (bound, maximum) = match key.as_str() {
            "depth" => (&mut limits.depth, NESTING_LIMIT),
            "values" => (&mut limits.values, NODE_LIMIT),
            _ => return Err(bad_limits()),
        };
        *bound = limit(value)
            .filter(|n| (1..=maximum as u64).contains(n))
            .ok_or_else(bad_limits)?;
    }
    Ok(limits)
}

/// Add the levels and the nodes of `value`, which sits at `level`; a level past `depth` is not
/// descended, since it already exceeds the limit.
fn measure(value: &Value, level: u64, depth: u64, levels: &mut u64, nodes: &mut u64) {
    *nodes += 1;
    let children: Vec<&Value> = match value {
        Value::Array(items) => items.iter().collect(),
        Value::Object(members) => members.values().collect(),
        _ => return,
    };
    *levels = (*levels).max(level);
    if level > depth {
        return;
    }
    for child in children {
        measure(child, level + 1, depth, levels, nodes);
    }
}

/// Data beyond its limits is an input failure, its levels checked before its nodes (CUVR-082).
pub(crate) fn check_data_limits(data: &Value, limits: &DataLimits) -> Result<(), FormInputError> {
    let (mut levels, mut nodes) = (0, 0);
    measure(data, 1, limits.depth, &mut levels, &mut nodes);
    if levels > limits.depth {
        return Err(FormInputError::new(format!(
            "Submitted data exceeds the depth limit of {}",
            limits.depth
        )));
    }
    if nodes > limits.values {
        return Err(FormInputError::new(format!(
            "Submitted data exceeds the values limit of {}",
            limits.values
        )));
    }
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    /// An array of `n` zeros under a member: the root, the array and its items are `n + 2` nodes.
    fn nodes(n: usize) -> Value {
        json!({ "a": vec![0; n] })
    }

    #[test]
    fn a_root_without_values_takes_the_default_of_100000() {
        for (root, depth) in [
            (json!({}), 64),
            (json!({ "dataLimits": { "depth": 256 } }), 256),
        ] {
            let limits = data_limits(&root).unwrap();
            assert_eq!((limits.depth, limits.values), (depth, 100_000), "{root}");
            assert!(check_data_limits(&nodes(99_998), &limits).is_ok());
            let error = check_data_limits(&nodes(99_999), &limits).unwrap_err();
            assert_eq!(
                error.to_string(),
                "Submitted data exceeds the values limit of 100000"
            );
        }
    }
}
