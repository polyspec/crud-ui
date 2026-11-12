//! CRUDUI schema composition and validation.
#![deny(missing_docs)]

pub mod boundary;
pub mod compose;
pub mod detail;
pub mod expr;
pub mod forbidden_scan;
mod json_type;
pub mod list;
mod structure;
pub mod text;
pub mod types;
pub mod validate;

pub use detail::{validate_detail, ValidateDetailOptions};
pub use forbidden_scan::scan_forbidden_keys;
pub use list::{validate_list, ValidateListOptions};
pub use types::{
    BehaviorSlot, ConditionMap, ConditionValue, Content, DeclaredAttributes, DesignNode,
    DesignSlot, ExtraMap, FieldSpec, FormDataLimits, Items, ItemsSource, LangSpec, Layout,
    Multiple, MultipleSpec, OnlyKeyword, OptionsSlot, Polymorphic, ValidateSlot, WrapperNode,
    DEFAULT_KEY, FORBIDDEN_META_KEYS,
};

pub use validate::{
    hidden_paths, validate, FormInputError, ValidateError, ValidateOptions, Validator,
};
