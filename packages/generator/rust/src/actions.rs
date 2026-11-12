//! The action buttons of a form: resolving the target of a button and running it on the form (CURT-081 to CURT-090).

use crate::error::{FormError, FormResult};
use crate::instance::{AddRowOptions, CopyRowOptions, Form};

/// The eleven operations that an action button can request (CURT-081).
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ActionName {
    /// Move the row one position up.
    MoveUp,
    /// Move the row one position down.
    MoveDown,
    /// Insert a row, after the row key when the button declares one.
    AddRow,
    /// Copy the row after itself.
    CopyRow,
    /// Remove the row.
    RemoveRow,
    /// Expand or collapse the row.
    ToggleRow,
    /// Focus the row without changing the form.
    SelectRow,
    /// Expand every row.
    ExpandAll,
    /// Collapse every collapsible row.
    CollapseAll,
    /// Restore the record before the last change.
    Undo,
    /// Reapply the most recently undone change.
    Redo,
}

impl ActionName {
    /// The name that a button declares in `data-crudui-action`.
    pub fn as_str(self) -> &'static str {
        match self {
            Self::MoveUp => "move-up",
            Self::MoveDown => "move-down",
            Self::AddRow => "add-row",
            Self::CopyRow => "copy-row",
            Self::RemoveRow => "remove-row",
            Self::ToggleRow => "toggle-row",
            Self::SelectRow => "select-row",
            Self::ExpandAll => "expand-all",
            Self::CollapseAll => "collapse-all",
            Self::Undo => "undo",
            Self::Redo => "redo",
        }
    }

    /// The operation that a button names with its `data-crudui-action` value, or `None` for any other name.
    pub fn parse(name: &str) -> Option<Self> {
        Some(match name {
            "move-up" => Self::MoveUp,
            "move-down" => Self::MoveDown,
            "add-row" => Self::AddRow,
            "copy-row" => Self::CopyRow,
            "remove-row" => Self::RemoveRow,
            "toggle-row" => Self::ToggleRow,
            "select-row" => Self::SelectRow,
            "expand-all" => Self::ExpandAll,
            "collapse-all" => Self::CollapseAll,
            "undo" => Self::Undo,
            "redo" => Self::Redo,
            _ => return None,
        })
    }
}

/// The values a button declares: its action, collection path and row key (CURT-081). An absent or empty member is
/// absent from the target.
#[derive(Debug, Default, Clone, serde::Deserialize)]
pub struct ActionInput {
    /// Requested operation name.
    pub action: Option<String>,
    /// Collection path of the nearest `[data-field-path]`.
    pub path: Option<String>,
    /// Row key of the nearest `[data-crudui-row-key]` inside that path element.
    pub key: Option<String>,
}

/// The operation, collection path and row key that an action button targets.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ActionTarget {
    /// Requested operation.
    pub name: ActionName,
    /// Collection path; `None` when the button declares none.
    pub path: Option<String>,
    /// Row key; `None` when the button declares none.
    pub key: Option<String>,
}

impl ActionTarget {
    /// The target that a button names by `name`; a name that is none of the eleven actions fails and changes
    /// nothing when it runs (CURT-091).
    pub fn named(name: &str, path: Option<String>, key: Option<String>) -> FormResult<Self> {
        let Some(name) = ActionName::parse(name) else {
            return Err(FormError::input(format!("Unknown action: {name}")));
        };
        Ok(Self { name, path, key })
    }
}

/// The row that receives focus after an action, or the collection itself when `key` is absent.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct FocusTarget {
    /// Collection path.
    pub path: String,
    /// Row key; absent when the collection has no rows left.
    pub key: Option<String>,
}

/// The outcome of an action that ran.
#[derive(Debug, Default, Clone, PartialEq, Eq)]
pub struct ActionResult {
    /// Focus destination; absent when focus stays on the current control.
    pub focus: Option<FocusTarget>,
}

/// Resolve the target of the values a button declares; `None` when the action is none of the eleven actions.
pub fn resolve_action(input: &ActionInput) -> Option<ActionTarget> {
    let name = ActionName::parse(input.action.as_deref()?)?;
    Some(ActionTarget {
        name,
        path: non_empty(&input.path),
        key: non_empty(&input.key),
    })
}

/// Run a resolved action on the form. `None` when the target lacks the path or key that the action needs; a failing
/// operation returns its error and leaves the form unchanged (CURT-090).
pub fn run_action(form: &mut Form, target: &ActionTarget) -> FormResult<Option<ActionResult>> {
    match target.name {
        ActionName::ExpandAll | ActionName::CollapseAll => {
            form.set_all_expanded(target.name == ActionName::ExpandAll)?;
            return Ok(Some(ActionResult::default()));
        }
        ActionName::Undo => {
            form.undo()?;
            return Ok(Some(ActionResult::default()));
        }
        ActionName::Redo => {
            form.redo()?;
            return Ok(Some(ActionResult::default()));
        }
        _ => {}
    }
    let Some(path) = target.path.as_deref().filter(|path| !path.is_empty()) else {
        return Ok(None);
    };
    if target.name == ActionName::AddRow {
        // Without a declared key the row is appended; with one it is inserted after that row.
        let options = AddRowOptions {
            after_key: target.key.clone(),
            ..AddRowOptions::default()
        };
        let key = form.add_row(path, options)?;
        return Ok(Some(focus_on(path, &key)));
    }
    let Some(key) = target.key.as_deref().filter(|key| !key.is_empty()) else {
        return Ok(None);
    };
    let result = match target.name {
        ActionName::CopyRow => {
            let copied = form.copy_row(path, key, CopyRowOptions::default())?;
            focus_on(path, &copied)
        }
        ActionName::RemoveRow => {
            let keys = row_keys(form, path)?;
            let index = keys.iter().position(|known| known == key);
            // Focus goes to the previous row, else the next row, else the collection.
            let neighbour = index.and_then(|index| {
                if index > 0 {
                    keys.get(index - 1)
                } else {
                    keys.get(index + 1)
                }
            });
            form.remove_row(path, key)?;
            match neighbour {
                Some(neighbour) => focus_on(path, neighbour),
                None => ActionResult {
                    focus: Some(FocusTarget {
                        path: path.to_owned(),
                        key: None,
                    }),
                },
            }
        }
        ActionName::ToggleRow => {
            form.toggle_row(path, key)?;
            ActionResult::default()
        }
        // Selecting changes no state: it only moves focus to the row.
        ActionName::SelectRow => focus_on(path, key),
        ActionName::MoveUp | ActionName::MoveDown => {
            let keys = row_keys(form, path)?;
            // A key that the collection lacks gives no position; the move then fails with the unknown row.
            let Some(from) = keys.iter().position(|known| known == key) else {
                return Err(FormError::input(format!("Unknown row: {key}")));
            };
            let Ok(from) = i64::try_from(from) else {
                return Err(FormError::input(format!("Invalid row position: {from}")));
            };
            let step = if target.name == ActionName::MoveUp {
                -1
            } else {
                1
            };
            form.move_row(path, key, from + step)?;
            focus_on(path, key)
        }
        ActionName::AddRow => unreachable!("add-row returns before the key is read"),
        ActionName::ExpandAll | ActionName::CollapseAll | ActionName::Undo | ActionName::Redo => {
            unreachable!("the form-wide actions return before the path is read")
        }
    };
    Ok(Some(result))
}

/// The value of an optional member, where an empty string counts as absent.
fn non_empty(value: &Option<String>) -> Option<String> {
    value
        .as_deref()
        .filter(|text| !text.is_empty())
        .map(str::to_owned)
}

/// The result of an action that focuses the row `key` of the collection at `path`.
fn focus_on(path: &str, key: &str) -> ActionResult {
    ActionResult {
        focus: Some(FocusTarget {
            path: path.to_owned(),
            key: Some(key.to_owned()),
        }),
    }
}

/// The row keys of the keyed collection at `path`, in order.
fn row_keys(form: &Form, path: &str) -> FormResult<Vec<String>> {
    match form.get_value(path)? {
        Some(serde_json::Value::Object(rows)) => Ok(rows.keys().cloned().collect()),
        _ => Err(FormError::input(format!(
            "Repeated data must be a keyed object: {path}"
        ))),
    }
}
