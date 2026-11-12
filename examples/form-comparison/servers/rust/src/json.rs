use crate::{bad, Result};
use polyspec_json::{Kind, OrderedMap, ParseOptions, StringifyOptions, Value as Ordered};
use serde_json::{Map, Value};

/// Decode ordered JSON into the validator's existing ordered record model. Form data numbers are
/// finite and integers are exact.
pub fn decode(bytes: &[u8]) -> Result<Value> {
    from_ordered(&parse(bytes)?, true)
}

/// Decode ordered JSON whose numbers are any finite double, such as a stored record score.
pub fn decode_values(bytes: &[u8]) -> Result<Value> {
    from_ordered(&parse(bytes)?, false)
}

fn parse(bytes: &[u8]) -> Result<Ordered> {
    polyspec_json::parse(bytes, &ParseOptions::default()).map_err(|e| bad(e.to_string()))
}

fn string_from_ordered(value: &Ordered) -> Result<String> {
    value.string_value().map_err(|error| bad(error.to_string()))
}

fn from_ordered(value: &Ordered, exact: bool) -> Result<Value> {
    Ok(match value.kind() {
        Kind::Object => {
            let mut result = Map::new();
            for (key, child) in value.members().unwrap().iter() {
                result.insert(string_from_ordered(key)?, from_ordered(child, exact)?);
            }
            Value::Object(result)
        }
        Kind::Array => Value::Array(
            value
                .items()
                .unwrap()
                .iter()
                .map(|item| from_ordered(item, exact))
                .collect::<Result<_>>()?,
        ),
        Kind::String => Value::String(string_from_ordered(value)?),
        Kind::Boolean => Value::Bool(value.boolean_value().unwrap()),
        Kind::Null => Value::Null,
        Kind::Number => {
            let literal = value.number_literal().unwrap();
            let number: f64 = literal
                .parse()
                .map_err(|error| bad(format!("Invalid JSON number: {error}")))?;
            check_number(number, exact)?;
            Value::Number(
                literal
                    .parse()
                    .map_err(|error| bad(format!("Invalid JSON number: {error}")))?,
            )
        }
    })
}

fn check_number(value: f64, exact: bool) -> Result<()> {
    if !value.is_finite()
        || (exact && value.fract() == 0.0 && value.abs() > 9_007_199_254_740_991.0)
    {
        return Err(bad("JSON number exceeds the form data range"));
    }
    Ok(())
}

/// Encode form storage through the same ordered JSON processor.
pub fn encode(value: &Value) -> Result<String> {
    Ok(polyspec_json::stringify(
        &to_ordered(value, true)?,
        &StringifyOptions::default(),
    ))
}

/// Encode responses and record storage, whose numbers are any finite double.
pub fn encode_values(value: &Value) -> Result<String> {
    Ok(polyspec_json::stringify(
        &to_ordered(value, false)?,
        &StringifyOptions::default(),
    ))
}

fn to_ordered(value: &Value, exact: bool) -> Result<Ordered> {
    Ok(match value {
        Value::Object(values) => {
            let mut members = OrderedMap::new();
            for (key, value) in values {
                members
                    .insert(Ordered::string(key), to_ordered(value, exact)?)
                    .map_err(|e| bad(e.to_string()))?;
            }
            Ordered::object(&members).map_err(|e| bad(e.to_string()))?
        }
        Value::Array(values) => Ordered::array(
            &values
                .iter()
                .map(|item| to_ordered(item, exact))
                .collect::<Result<Vec<_>>>()?,
        )
        .map_err(|e| bad(e.to_string()))?,
        Value::String(value) => Ordered::string(value),
        Value::Bool(value) => Ordered::boolean(*value),
        Value::Null => Ordered::null(),
        Value::Number(value) => {
            check_number(
                value.as_f64().ok_or_else(|| bad("Invalid JSON number"))?,
                exact,
            )?;
            Ordered::number(&crate::records::number_text(value)).map_err(|e| bad(e.to_string()))?
        }
    })
}
