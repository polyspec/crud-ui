//! Specification member order (docs/spec/schema.md, "Member order").
//!
//! Every object inside a specification lists its members in JavaScript's
//! own-property order: names that are array indexes (canonical decimal integers
//! from 0 to 4294967294) first in ascending numeric order, then every other name
//! in insertion order. Record data keeps its arrival order and is never passed
//! through this module.

use serde_json::{Map, Value};

/// The largest array index (2^32 - 2).
const MAX_ARRAY_INDEX: u64 = 4_294_967_294;

/// The numeric value of a member name that is an array index: a canonical decimal
/// integer from 0 to 4294967294 without a sign or leading zeros.
fn array_index(name: &str) -> Option<u64> {
    let bytes = name.as_bytes();
    if bytes.is_empty()
        || bytes.len() > 10
        || !bytes.iter().all(u8::is_ascii_digit)
        || (bytes.len() > 1 && bytes[0] == b'0')
    {
        return None;
    }
    // The checks above leave at most ten ASCII digits, which always fit a u64.
    let index = bytes
        .iter()
        .fold(0u64, |index, digit| index * 10 + u64::from(digit - b'0'));
    (index <= MAX_ARRAY_INDEX).then_some(index)
}

/// A copy of a specification value with every object, at every depth, in
/// specification member order. Arrays keep their element order.
pub fn member_ordered(value: &Value) -> Value {
    match value {
        Value::Object(map) => Value::Object(member_ordered_map(map)),
        Value::Array(items) => Value::Array(items.iter().map(member_ordered).collect()),
        other => other.clone(),
    }
}

/// A copy of a specification object with its members, and every nested object,
/// in specification member order.
pub fn member_ordered_map(map: &Map<String, Value>) -> Map<String, Value> {
    let mut indexes: Vec<(u64, &String, &Value)> = Vec::new();
    let mut names: Vec<(&String, &Value)> = Vec::new();
    for (name, value) in map {
        match array_index(name) {
            Some(index) => indexes.push((index, name, value)),
            None => names.push((name, value)),
        }
    }
    indexes.sort_by_key(|(index, _, _)| *index);
    let mut out = Map::with_capacity(map.len());
    for (_, name, value) in indexes {
        out.insert(name.clone(), member_ordered(value));
    }
    for (name, value) in names {
        out.insert(name.clone(), member_ordered(value));
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn keys(value: &Value) -> Vec<&str> {
        value
            .as_object()
            .unwrap()
            .keys()
            .map(String::as_str)
            .collect()
    }

    /// Build an object with members inserted in exactly the given order.
    fn object(names: &[&str]) -> Value {
        let mut map = Map::new();
        for name in names {
            map.insert((*name).to_string(), Value::Null);
        }
        Value::Object(map)
    }

    #[test]
    fn array_indexes_come_first_in_numeric_order() {
        let ordered = member_ordered(&object(&["b", "10", "a", "2", "0"]));
        assert_eq!(keys(&ordered), vec!["0", "2", "10", "b", "a"]);
    }

    #[test]
    fn index_boundaries_follow_the_canonical_form() {
        let ordered = member_ordered(&object(&[
            "z",
            "4294967295",
            "01",
            "-1",
            "4294967294",
            "1.5",
            "",
            " 1",
            "+1",
            "0",
            "99999999999",
        ]));
        assert_eq!(
            keys(&ordered),
            vec![
                "0",
                "4294967294",
                "z",
                "4294967295",
                "01",
                "-1",
                "1.5",
                "",
                " 1",
                "+1",
                "99999999999"
            ]
        );
    }

    #[test]
    fn nested_objects_and_array_elements_are_ordered() {
        let mut inner = object(&["y", "3"]);
        inner["y"] = object(&["q", "7"]);
        let mut outer = Map::new();
        outer.insert(
            "list".into(),
            Value::Array(vec![object(&["b", "1"]), json!(5)]),
        );
        outer.insert("5".into(), inner);
        let ordered = member_ordered(&Value::Object(outer));
        assert_eq!(keys(&ordered), vec!["5", "list"]);
        assert_eq!(keys(&ordered["5"]), vec!["3", "y"]);
        assert_eq!(keys(&ordered["5"]["y"]), vec!["7", "q"]);
        assert_eq!(keys(&ordered["list"][0]), vec!["1", "b"]);
        assert_eq!(ordered["list"][1], json!(5));
    }

    #[test]
    fn the_input_is_left_untouched() {
        let data = object(&["b", "10", "a"]);
        let ordered = member_ordered(&data);
        assert_eq!(keys(&ordered), vec!["10", "b", "a"]);
        assert_eq!(keys(&data), vec!["b", "10", "a"]);
    }
}
