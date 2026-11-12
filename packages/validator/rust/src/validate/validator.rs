//! CRUDUI form validator (SPEC §2 G5→§3→§2 G1, JS `Validator` parity).
//!
//! The third pass of the CRUDUI pipeline. It consumes a COMPOSED CRUDUI field model (the
//! `validate`/`design`/`behavior`/`options` role slots) AFTER the compose pass has
//! expanded `$ref`/`$patch`. Its field-model logic: (a) reading the `validate` slot
//! (there is no `rules` key); (b) evaluating a rule value that is an expression OR a condition
//! map (G1 — the condition is the value's expression, never a separate key); and
//! (c) visibility from `design.show` alone: a hidden field and its descendants are
//! not evaluated (`display_switch`/`display_target` are forbidden keys, G1).
//!
//! Byte-for-byte with the JS reference; the shared 4-language fixture
//! `tests/fixtures/validate/cases.json` is the single source of truth. errors are
//! collected in declaration/traversal order and NEVER reordered.

use std::cell::RefCell;
use std::collections::{HashMap, HashSet};

use serde_json::{Map, Value};

use crate::compose::{ComposeErrorCode, ComposeLoadError};
use crate::expr::{Evaluator, Expression, Node};

use super::choice_data::{check_single_choice_data, is_single_choice};
use super::errors::{FormInputError, ValidateError};
use super::group_source::{group_choices, group_source_repeat, is_group_source, GroupChoicesError};
use super::keyed_maps::check_keyed_map_keys;
use super::membership::Comparable;
use super::parameters::{check, check_declared, Patterns};
use super::rules::{get_rule, is_condition_expression, RuleContext};
use super::visibility::is_visible;

/// A single validation error (JS `ValidationError`: path/field/rule/message/value).
#[derive(Debug, Clone, PartialEq)]
pub struct ValidationError {
    /// Dot-joined absolute path to the field (`items.1.code`, `rows.__a__.v`).
    pub path: String,
    /// The path's last segment.
    pub field: String,
    /// The failed rule's name (verbatim — `pattern`/`match` aliases distinct).
    pub rule: String,
    /// The display message (override → default with `{0}`/`{1}` → fallback).
    pub message: String,
    /// The failing value (the whole array for an array-level rule).
    pub value: Value,
}

impl ValidationError {
    /// Serialize to the cross-language JSON object shape.
    pub fn to_value(&self) -> Value {
        let mut m = Map::new();
        m.insert("path".to_string(), Value::String(self.path.clone()));
        m.insert("field".to_string(), Value::String(self.field.clone()));
        m.insert("rule".to_string(), Value::String(self.rule.clone()));
        m.insert("message".to_string(), Value::String(self.message.clone()));
        m.insert("value".to_string(), self.value.clone());
        Value::Object(m)
    }
}

/// The validation result (JS `{ valid, errors, hidden }`).
#[derive(Debug, Clone, PartialEq)]
pub struct ValidationResult {
    /// True iff there are no errors.
    pub valid: bool,
    /// Errors in traversal/declaration order (never reordered).
    pub errors: Vec<ValidationError>,
    /// Data paths of the fields whose `design.show` resolves to false, in
    /// declaration order (validation rules, "Evaluation").
    pub hidden: Vec<String>,
}

// ---------------------------------------------------------------------------
// Rule-class tables (identical to the JS reference `Validator`).
// ---------------------------------------------------------------------------

/// Rules that apply to the whole array of a `multiple` field.
const ARRAY_LEVEL_RULES: &[&str] = &["required", "unique", "mincount", "maxcount"];

/// Rules whose param is a field reference / filter — preserved verbatim.
const PATH_REFERENCE_RULES: &[&str] = &[
    "equalTo",
    "containedIn",
    "typeFrom",
    "minFrom",
    "maxFrom",
    "notEqual",
    "unique",
    "enddate",
    "reference",
];

/// Rules whose param is a literal value, never a condition or a condition map.
const LITERAL_PARAM_RULES: &[&str] = &["accept", "conditionTree"];

/// Rules whose string param is a pattern preserved verbatim.
const PATTERN_PARAM_RULES: &[&str] = &["match", "pattern"];

/// Membership rules whose param is the allowed-value SET (an array, comma string,
/// or a static value→label map, SPEC §2 G3). The param is data, NOT a
/// condition map — an object param is the value→label map (key = option value,
/// value = display label), kept verbatim and never evaluated key-by-key as
/// expressions. The rule's flatten reads keys for a value→label map (the label,
/// possibly a LangMap or null, is display-only).
const MEMBERSHIP_PARAM_RULES: &[&str] = &["in"];

/// The state of one `validate` call, dropped when it returns.
pub(crate) struct Run<'a> {
    /// The whole form data.
    pub(crate) data: &'a Value,
    /// For each collection field (container path, field name and filter), the row keys whose
    /// `unique` value an earlier row already holds.
    pub(crate) unique_duplicates: RefCell<HashMap<String, HashSet<String>>>,
    /// The composed root field map, which a `reference` parameter names a field of.
    pub(crate) properties: &'a Map<String, Value>,
    /// For each declaration path that `reference` names, its ids in the data, collected once.
    pub(crate) reference_ids: RefCell<HashMap<String, Vec<Comparable>>>,
}

/// The CRUDUI validator over a composed spec.
pub struct Validator {
    properties: Map<String, Value>,
    patterns: Patterns,
}

impl Validator {
    /// Build from a composed root group's `properties` map, checking every
    /// declared rule parameter. A parameter outside the validation-rule
    /// definitions returns a load failure located at the field's declaration path.
    pub fn new(properties: Map<String, Value>) -> Result<Self, ValidateError> {
        let patterns = check_declared(&properties)?;
        Ok(Validator {
            properties,
            patterns,
        })
    }

    /// Validate `data` against the composed CRUDUI spec. Root, group and repeated
    /// data with the wrong shape return an input failure, and a parameter selected
    /// by a condition that is outside the definitions returns a load failure;
    /// neither produces a result.
    pub fn validate(&self, data: &Value) -> Result<ValidationResult, ValidateError> {
        if !data.is_object() {
            return Err(FormInputError::new("Form data must be an object").into());
        }
        let mut errors: Vec<ValidationError> = Vec::new();
        let run = Run {
            data,
            unique_duplicates: RefCell::new(HashMap::new()),
            properties: &self.properties,
            reference_ids: RefCell::new(HashMap::new()),
        };
        self.validate_properties(
            &self.properties,
            data,
            &[],
            &[],
            &[],
            &run,
            false,
            &mut errors,
        )?;
        let mut hidden = Vec::new();
        collect_hidden(&self.properties, data, &[], &[], data, &mut hidden);
        Ok(ValidationResult {
            valid: errors.is_empty(),
            errors,
            hidden,
        })
    }

    // =====================================================================
    // Field traversal (SPEC §3).
    // =====================================================================

    /// `current_path` is the data path (with row keys); `declaration_path` is the
    /// field's declaration path (without row keys); `hidden` says an enclosing field
    /// is hidden, so only the data shape is checked.
    #[allow(
        clippy::too_many_arguments,
        reason = "the walk of the validator passes its traversal state explicitly, as the engines of the other languages do"
    )]
    fn validate_properties(
        &self,
        properties: &Map<String, Value>,
        data: &Value,
        current_path: &[String],
        row_keys: &[usize],
        declaration_path: &[String],
        run: &Run<'_>,
        hidden: bool,
        errors: &mut Vec<ValidationError>,
    ) -> Result<(), ValidateError> {
        if let Some(object) = data.as_object() {
            let mut unknown: Vec<&String> = object
                .keys()
                .filter(|name| !properties.contains_key(name.as_str()))
                .collect();
            unknown.sort();
            if let Some(name) = unknown.first() {
                let mut path = current_path.to_vec();
                path.push((*name).clone());
                return Err(FormInputError::new(format!(
                    "Unknown form data field: {}",
                    path_to_string(&path)
                ))
                .into());
            }
        }
        let all_data = run.data;
        let empty = Value::Object(Map::new());
        for (property_key, field) in properties {
            if !field.is_object() {
                continue;
            }
            let is_multiple = is_multiple(field);
            let mut field_path = current_path.to_vec();
            field_path.push(property_key.clone());
            let mut declaration = declaration_path.to_vec();
            declaration.push(property_key.clone());
            let declaration = declaration.as_slice();
            // The rules of a hidden field and of everything it contains are not
            // evaluated; the data shape is checked all the same.
            let hidden = hidden || !is_visible(field, all_data, &field_path, row_keys);
            let present = data.get(property_key);
            #[allow(
                clippy::disallowed_methods,
                reason = "R-1: listed in the audit of the crudui core: an absent value is validated as null (CUVR-001)"
            )]
            let field_value = present.cloned().unwrap_or(Value::Null);

            if is_multiple && present.is_some_and(|value| !value.is_object()) {
                return Err(FormInputError::new(format!(
                    "Repeated data must be a keyed object: {}",
                    path_to_string(&field_path)
                ))
                .into());
            }
            if let Some(rows) = present.and_then(Value::as_object).filter(|_| is_multiple) {
                check_keyed_map_keys(field, rows, &field_path, row_keys, all_data)?;
            }
            if let Some(value) = present.filter(|_| is_single_choice(field)) {
                check_single_choice_data(value, &field_path, is_multiple)?;
            }

            if let Some(child_props) = is_group_with_properties(field) {
                if is_multiple {
                    // Missing data is an empty collection: no rows.
                    if let Some(Value::Object(rows)) = present {
                        // Keyed rows use sorted-key traversal so the first reported
                        // error is identical in every validation implementation.
                        let mut keys: Vec<&String> = rows.keys().collect();
                        keys.sort();
                        for key in keys {
                            let mut row_path = field_path.clone();
                            row_path.push(key.clone());
                            let row = &rows[key.as_str()];
                            if !row.is_object() {
                                return Err(FormInputError::new(format!(
                                    "Group data must be an object: {}",
                                    path_to_string(&row_path)
                                ))
                                .into());
                            }
                            let mut row_rows = row_keys.to_vec();
                            row_rows.push(field_path.len());
                            self.validate_properties(
                                child_props,
                                row,
                                &row_path,
                                &row_rows,
                                declaration,
                                run,
                                hidden,
                                errors,
                            )?;
                        }
                    }
                    if !hidden {
                        errors.extend(self.validate_field_rules(
                            field,
                            &field_value,
                            &field_path,
                            row_keys,
                            declaration,
                            run,
                            false,
                        )?);
                    }
                } else {
                    if present.is_some_and(|value| !value.is_object()) {
                        return Err(FormInputError::new(format!(
                            "Group data must be an object: {}",
                            path_to_string(&field_path)
                        ))
                        .into());
                    }
                    #[allow(
                        clippy::disallowed_methods,
                        reason = "CURT-002: missing group data is no failure and holds no value"
                    )]
                    let nested = present.unwrap_or(&empty);
                    self.validate_properties(
                        child_props,
                        nested,
                        &field_path,
                        row_keys,
                        declaration,
                        run,
                        hidden,
                        errors,
                    )?;
                    if !hidden {
                        errors.extend(self.validate_field_rules(
                            field,
                            &field_value,
                            &field_path,
                            row_keys,
                            declaration,
                            run,
                            false,
                        )?);
                    }
                }
            } else if hidden {
                // A hidden scalar field has no rules to run and no shape below it.
            } else if is_multiple {
                // Missing data is an empty collection: no rows.
                let no_rows = Map::new();
                let rows = match present {
                    Some(Value::Object(rows)) => rows,
                    _ => &no_rows,
                };
                self.validate_multiple_field_rules(
                    field,
                    &field_value,
                    rows,
                    &field_path,
                    row_keys,
                    declaration,
                    run,
                    errors,
                )?;
            } else {
                errors.extend(self.validate_field_rules(
                    field,
                    &field_value,
                    &field_path,
                    row_keys,
                    declaration,
                    run,
                    false,
                )?);
            }
        }
        Ok(())
    }

    // =====================================================================
    // validate-slot evaluation (SPEC §3 slots.validate).
    // =====================================================================

    /// Collection rules and per-row rules for a repeated scalar field.
    #[allow(
        clippy::too_many_arguments,
        reason = "the walk of the validator passes its traversal state explicitly, as the engines of the other languages do"
    )]
    fn validate_multiple_field_rules(
        &self,
        field: &Value,
        values: &Value,
        rows: &Map<String, Value>,
        field_path: &[String],
        row_keys: &[usize],
        declaration: &[String],
        run: &Run<'_>,
        errors: &mut Vec<ValidationError>,
    ) -> Result<(), ValidateError> {
        let messages = field.get("messages");
        let mut entries: Vec<(String, &Value)> = rows.iter().map(|(k, v)| (k.clone(), v)).collect();
        entries.sort_by(|a, b| a.0.cmp(&b.0));

        // 1. Array-level rules in declaration order; first error wins.
        if let Some(rules) = normalize_validate_slot(field) {
            for (rule_name, rule_value) in rules {
                if !ARRAY_LEVEL_RULES.contains(&rule_name.as_str()) {
                    continue;
                }
                if let Some(message) = self.run_rule(
                    rule_name,
                    rule_value,
                    values,
                    field_path,
                    row_keys,
                    declaration,
                    messages,
                    run,
                )? {
                    errors.push(ValidationError {
                        path: path_to_string(field_path),
                        field: field_name(field_path),
                        rule: rule_name.clone(),
                        message,
                        value: values.clone(),
                    });
                    return Ok(());
                }
            }
        }

        // 2. Row rules in sorted row-key order.
        for (key, value) in entries {
            let mut item_path = field_path.to_vec();
            item_path.push(key);
            let mut item_rows = row_keys.to_vec();
            item_rows.push(field_path.len());
            errors.extend(self.validate_field_rules(
                field,
                value,
                &item_path,
                &item_rows,
                declaration,
                run,
                true,
            )?);
        }
        Ok(())
    }

    /// All rules for a single (scalar or group-as-whole) field, or, with `element_level`, the
    /// element-level rules of one element of a `multiple` field (no array-level rule).
    #[allow(
        clippy::too_many_arguments,
        reason = "the walk of the validator passes its traversal state explicitly, as the engines of the other languages do"
    )]
    fn validate_field_rules(
        &self,
        field: &Value,
        value: &Value,
        field_path: &[String],
        row_keys: &[usize],
        declaration: &[String],
        run: &Run<'_>,
        element_level: bool,
    ) -> Result<Option<ValidationError>, ValidateError> {
        let messages = field.get("messages");
        let rules = normalize_validate_slot(field);

        if let Some(error) =
            self.run_implicit_number(field, rules, value, field_path, row_keys, messages, run)?
        {
            return Ok(Some(error));
        }
        if let Some(error) = self.run_group_source(
            field,
            value,
            field_path,
            row_keys,
            declaration,
            messages,
            run,
        )? {
            return Ok(Some(error));
        }
        let rules = match rules {
            Some(r) => r,
            None => return Ok(None),
        };
        for (rule_name, rule_value) in rules {
            if element_level && ARRAY_LEVEL_RULES.contains(&rule_name.as_str()) {
                continue;
            }
            if let Some(message) = self.run_rule(
                rule_name,
                rule_value,
                value,
                field_path,
                row_keys,
                declaration,
                messages,
                run,
            )? {
                return Ok(Some(ValidationError {
                    path: path_to_string(field_path),
                    field: field_name(field_path),
                    rule: rule_name.clone(),
                    message,
                    value: value.clone(),
                }));
            }
        }
        Ok(None)
    }

    /// A field whose `items` is a group source runs an implicit `in` check against the choices
    /// that the source gives for the root data, before its declared rules (validation-rules.md,
    /// "Values"). Returns the error of the check when it fails.
    #[allow(
        clippy::too_many_arguments,
        reason = "the walk of the validator passes its traversal state explicitly, as the engines of the other languages do"
    )]
    fn run_group_source(
        &self,
        field: &Value,
        value: &Value,
        path: &[String],
        row_keys: &[usize],
        declaration: &[String],
        messages: Option<&Value>,
        run: &Run<'_>,
    ) -> Result<Option<ValidationError>, ValidateError> {
        let Some(items) = field.get("items").filter(|items| is_group_source(items)) else {
            return Ok(None);
        };
        // A repeated value among the source rows is data that the choices cannot express (CUVR-087).
        if let Some(repeat) = group_source_repeat(items, run.data) {
            return Err(FormInputError::new(repeat).into());
        }
        let choices =
            group_choices(items, run.data, &declaration.join(".")).map_err(
                |error| match error {
                    GroupChoicesError::Declaration(message) => {
                        ValidateError::Load(ComposeLoadError::with_trace(
                            ComposeErrorCode::InvalidRuleParameter,
                            message,
                            declaration.to_vec(),
                        ))
                    }
                    GroupChoicesError::Repeated(message) => {
                        ValidateError::Input(FormInputError::new(message))
                    }
                },
            )?;
        let members = Value::Array(
            choices
                .into_iter()
                .map(|choice| Value::String(choice.value))
                .collect(),
        );
        let Some(message) = self.run_rule(
            "in",
            &members,
            value,
            path,
            row_keys,
            declaration,
            messages,
            run,
        )?
        else {
            return Ok(None);
        };
        Ok(Some(ValidationError {
            path: path_to_string(path),
            field: field_name(path),
            rule: "in".to_string(),
            message,
            value: value.clone(),
        }))
    }

    /// `type:number` runs an implicit `number` rule first when no explicit
    /// `number` rule is declared. Returns the error of the rule when it fails.
    #[allow(
        clippy::too_many_arguments,
        reason = "the walk of the validator passes its traversal state explicitly, as the engines of the other languages do"
    )]
    fn run_implicit_number(
        &self,
        field: &Value,
        rules: Option<&Map<String, Value>>,
        value: &Value,
        path: &[String],
        row_keys: &[usize],
        messages: Option<&Value>,
        run: &Run<'_>,
    ) -> Result<Option<ValidationError>, ValidateError> {
        if field.get("type").and_then(Value::as_str) != Some("number") {
            return Ok(None);
        }
        if rules.is_some_and(|r| r.contains_key("number")) {
            return Ok(None);
        }
        // The implicit `number` parameter is `true`; it has nothing to check.
        if let Some(message) = self.run_rule(
            "number",
            &Value::Bool(true),
            value,
            path,
            row_keys,
            &[],
            messages,
            run,
        )? {
            return Ok(Some(ValidationError {
                path: path_to_string(path),
                field: field_name(path),
                rule: "number".to_string(),
                message,
                value: value.clone(),
            }));
        }
        Ok(None)
    }

    // =====================================================================
    // Conditional rule value (G1) — expression / condition map → param.
    // =====================================================================

    /// Run one rule: resolve its (possibly conditional) value to an effective
    /// param, skip on false/null, check the parameter, else call the rule.
    /// Returns the error message, `None` on a pass, or the failure of a selected
    /// parameter located at `declaration`.
    #[allow(
        clippy::too_many_arguments,
        reason = "the walk of the validator passes its traversal state explicitly, as the engines of the other languages do"
    )]
    fn run_rule(
        &self,
        rule_name: &str,
        rule_value: &Value,
        value: &Value,
        current_path: &[String],
        row_keys: &[usize],
        declaration: &[String],
        messages: Option<&Value>,
        run: &Run<'_>,
    ) -> Result<Option<String>, ValidateError> {
        let all_data = run.data;
        let effective =
            self.resolve_rule_value(rule_name, rule_value, current_path, row_keys, all_data);

        // A false/null effective param disables the rule.
        if is_disabled(&effective) {
            return Ok(None);
        }

        // Rule names are checked when the specification loads.
        let Some(rule_fn) = get_rule(rule_name) else {
            unreachable!("rule {rule_name} is not registered");
        };

        // Declared parameters were checked when the specification loaded (patterns
        // are compiled then); a selected parameter is checked now.
        let parameter = check(rule_name, &effective, declaration, &self.patterns)?;

        let ctx = RuleContext {
            value,
            rule_param: &effective,
            parameter: &parameter,
            messages,
            rule_name,
            path_segments: current_path,
            row_keys,
            form_data: all_data,
            run,
        };
        Ok(rule_fn(&ctx))
    }

    /// Resolve a rule value to the effective param (G1).
    fn resolve_rule_value(
        &self,
        rule_name: &str,
        rule_value: &Value,
        current_path: &[String],
        row_keys: &[usize],
        all_data: &Value,
    ) -> Value {
        match resolution(rule_name, rule_value) {
            Resolution::Verbatim | Resolution::Literal => rule_value.clone(),
            Resolution::ConditionMap(map) => {
                self.resolve_condition_map(map, current_path, row_keys, all_data)
            }
            Resolution::Ternary(node) => {
                Evaluator::new(all_data, current_path, row_keys).evaluate_value(&node)
            }
            Resolution::Expression(expression) => {
                evaluate_expression_value(expression, all_data, current_path, row_keys)
            }
        }
    }

    /// Evaluate a ConditionMap (expressions.md §8): first truthy key wins;
    /// else the `true` key; else null (disabled).
    fn resolve_condition_map(
        &self,
        map: &Map<String, Value>,
        current_path: &[String],
        row_keys: &[usize],
        all_data: &Value,
    ) -> Value {
        for (key, val) in map {
            if key == "true" {
                continue;
            }
            if evaluate_condition(key, all_data, current_path, row_keys) {
                return val.clone();
            }
        }
        if let Some(v) = map.get("true") {
            return v.clone();
        }
        Value::Null
    }
}

// ---------------------------------------------------------------------------
// How a rule value becomes its parameter (shared with the parameter checks).
// ---------------------------------------------------------------------------

/// How a declared rule value becomes the rule's parameter.
enum Resolution<'a> {
    /// A rule that receives its value unchanged.
    Verbatim,
    /// A condition map selecting a value.
    ConditionMap(&'a Map<String, Value>),
    /// A ternary expression selecting a branch value.
    Ternary(Node),
    /// A condition expression whose value is the parameter.
    Expression(&'a str),
    /// A literal parameter.
    Literal,
}

fn resolution<'a>(rule_name: &str, rule_value: &'a Value) -> Resolution<'a> {
    // Verbatim-param rules: never evaluate (field ref / literal / pattern /
    // membership set). A membership param object is a value→label map (G3),
    // not a condition map.
    if PATH_REFERENCE_RULES.contains(&rule_name)
        || LITERAL_PARAM_RULES.contains(&rule_name)
        || PATTERN_PARAM_RULES.contains(&rule_name)
        || MEMBERSHIP_PARAM_RULES.contains(&rule_name)
    {
        return Resolution::Verbatim;
    }
    match rule_value {
        Value::Object(map) => Resolution::ConditionMap(map),
        Value::String(s) => {
            // A complete ternary AST selects a branch; other strings are
            // condition expressions or literal parameters.
            if let Ok(node @ Node::Ternary { .. }) = Expression::parse(s) {
                Resolution::Ternary(node)
            } else if is_condition_expression(s) && !has_ternary_regex(s) {
                Resolution::Expression(s)
            } else {
                Resolution::Literal
            }
        }
        _ => Resolution::Literal,
    }
}

/// Whether a declared rule value is selected by a condition, so its parameter is
/// checked when it is selected rather than when the specification loads.
pub(crate) fn is_conditional(rule_name: &str, rule_value: &Value) -> bool {
    matches!(
        resolution(rule_name, rule_value),
        Resolution::ConditionMap(_) | Resolution::Ternary(_) | Resolution::Expression(_)
    )
}

/// The literals a conditional rule value can select, which are checked when the
/// specification loads: every condition-map value, and every literal ternary
/// branch (through nested ternaries). A value a branch takes from the data is
/// checked only when it is selected.
pub(crate) fn selectable_literals(rule_name: &str, rule_value: &Value) -> Vec<Value> {
    let mut literals = Vec::new();
    match resolution(rule_name, rule_value) {
        Resolution::ConditionMap(map) => literals.extend(map.values().cloned()),
        Resolution::Ternary(node) => {
            let mut pending = vec![&node];
            while let Some(node) = pending.pop() {
                match node {
                    Node::Ternary {
                        true_value,
                        false_value,
                        ..
                    } => {
                        // The true branch is collected first.
                        pending.push(false_value);
                        pending.push(true_value);
                    }
                    Node::Group(inner) => pending.push(inner),
                    Node::Literal(literal) => literals.push(literal.to_value()),
                    _ => {}
                }
            }
        }
        Resolution::Verbatim | Resolution::Expression(_) | Resolution::Literal => {}
    }
    literals
}

/// Whether a parameter disables its rule (`false` or `null`).
pub(crate) fn is_disabled(parameter: &Value) -> bool {
    matches!(parameter, Value::Bool(false) | Value::Null)
}

/// Append the data paths of the fields whose `design.show` resolves to false, in
/// declaration order, each field of a group row under the row's key and the fields
/// inside a hidden field included. Data of another shape is read as missing.
fn collect_hidden(
    properties: &Map<String, Value>,
    data: &Value,
    current_path: &[String],
    row_keys: &[usize],
    all_data: &Value,
    hidden: &mut Vec<String>,
) {
    for (name, field) in properties {
        if !field.is_object() {
            continue;
        }
        let mut field_path = current_path.to_vec();
        field_path.push(name.clone());
        if !is_visible(field, all_data, &field_path, row_keys) {
            hidden.push(path_to_string(&field_path));
        }
        let Some(children) = is_group_with_properties(field) else {
            continue;
        };
        let empty = Value::Object(Map::new());
        #[allow(
            clippy::disallowed_methods,
            reason = "CURT-002: data that is missing or no object holds no hidden value"
        )]
        let value = data
            .get(name)
            .filter(|value| value.is_object())
            .unwrap_or(&empty);
        if !is_multiple(field) {
            collect_hidden(children, value, &field_path, row_keys, all_data, hidden);
            continue;
        }
        let Some(rows) = value.as_object() else {
            continue;
        };
        let mut keys: Vec<&String> = rows.keys().collect();
        keys.sort();
        for key in keys {
            let mut row_path = field_path.clone();
            row_path.push(key.clone());
            let mut row_rows = row_keys.to_vec();
            row_rows.push(field_path.len());
            #[allow(
                clippy::disallowed_methods,
                reason = "CURT-002: a row that is no object holds no hidden value"
            )]
            let row = Some(&rows[key.as_str()])
                .filter(|row| row.is_object())
                .unwrap_or(&empty);
            collect_hidden(children, row, &row_path, &row_rows, all_data, hidden);
        }
    }
}

/// The member declarations of a group field the validator descends into.
pub(crate) fn is_group_with_properties(field: &Value) -> Option<&Map<String, Value>> {
    if field.get("type").and_then(Value::as_str) != Some("group") {
        return None;
    }
    field.get("properties").and_then(Value::as_object)
}

// ---------------------------------------------------------------------------
// expression engine adapters (JS evaluateCondition / evaluateExpressionValue).
// ---------------------------------------------------------------------------

/// A condition that does not parse is not a condition: the JS reference
/// `evaluateCondition` catches the parse error and returns false
/// (packages/validator/ts/src/validate/validator.ts).
#[allow(
    clippy::disallowed_methods,
    reason = "a condition that does not parse is false"
)]
fn evaluate_condition(
    expression: &str,
    form_data: &Value,
    current_path: &[String],
    row_keys: &[usize],
) -> bool {
    Expression::evaluate(expression, form_data, current_path, row_keys).unwrap_or(false)
}

/// A value expression that does not parse is false: the JS reference
/// `evaluateExpressionValue` catches the parse error and returns false
/// (packages/validator/ts/src/validate/validator.ts).
#[allow(
    clippy::disallowed_methods,
    reason = "a value expression that does not parse is false"
)]
fn evaluate_expression_value(
    expression: &str,
    form_data: &Value,
    current_path: &[String],
    row_keys: &[usize],
) -> Value {
    Expression::evaluate_value(expression, form_data, current_path, row_keys)
        .unwrap_or(Value::Bool(false))
}

// ---------------------------------------------------------------------------
// field helpers.
// ---------------------------------------------------------------------------

/// Whether a field repeats: `multiple` is `true`, `only` or a settings object.
pub(crate) fn is_multiple(field: &Value) -> bool {
    match field.get("multiple") {
        Some(Value::Bool(true)) | Some(Value::Object(_)) => true,
        Some(Value::String(keyword)) => keyword == "only",
        _ => false,
    }
}

/// Normalize a polymorphic `validate` slot to a rule map. false/true/{}/absent →
/// None; an object → the rule map.
fn normalize_validate_slot(field: &Value) -> Option<&Map<String, Value>> {
    match field.get("validate") {
        Some(Value::Object(m)) => Some(m),
        _ => None,
    }
}

// ---------------------------------------------------------------------------
// Path utilities (JS pathToString / getFieldName).
// ---------------------------------------------------------------------------

pub(crate) fn path_to_string(path: &[String]) -> String {
    path.join(".")
}

fn field_name(path: &[String]) -> String {
    match path.last() {
        Some(name) => name.clone(),
        // A field path names at least its field.
        None => String::new(),
    }
}

// ---------------------------------------------------------------------------
// Identify strings containing ternary punctuation.
// ---------------------------------------------------------------------------

/// JS `/\?[^:]*:/` test: a '?' that has a ':' somewhere after it.
pub(crate) fn has_ternary_regex(s: &str) -> bool {
    if let Some(q) = s.find('?') {
        return s[q + 1..].contains(':');
    }
    false
}
