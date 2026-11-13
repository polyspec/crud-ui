//! CRUDUI form compilation, instance data, binding and HTML rendering.
#![deny(missing_docs)]

mod actions;
mod binding;
pub mod boundary;
mod buttons;
mod choice_list;
mod condition_editor;
mod css;
mod date;
mod design;
mod detail;
mod display_declaration;
mod error;
mod form_render;
mod history;
mod instance;
mod list;
mod messages;
mod number;
mod outline;
mod render;
mod template;
pub mod text;
mod util;
mod view;
mod widget;

pub use actions::{
    resolve_action, run_action, ActionInput, ActionName, ActionResult, ActionTarget, FocusTarget,
};
pub use binding::{bind_buttons, bind_form, form_buttons_html, BindOptions};
pub use detail::{build_detail, render_detail, DetailOptions};
pub use error::{FormError, FormErrorCode, FormResult};
pub use history::{
    can_redo, can_undo, empty_history, record_change, redo_change, undo_change, History,
    HistoryResult, HISTORY_LIMIT,
};

/// The fault injection points of the generator (binding G-5), named by the `faults` of the interface contract.
pub mod fault {
    /// The random source of the row keys (CURT-095).
    #[doc(hidden)]
    pub const RANDOM_SOURCE: &str = "crud_ui_generator.random_source";
}
pub use instance::{
    create_row_key, sequence_row_key, AddRowOptions, CopyRowOptions, Form, FormSnapshot,
};
pub use list::{build_list, list_rows, render_list, ListOptions};
pub use outline::{
    build_outline, render_data, render_data_panel, render_outline, render_outline_view,
};
pub use render::{render_form, render_form_view};
pub use template::{compile_form, CompileOptions, FieldTemplate, FormTemplate};
pub use view::{
    collapsible_rows, initial_view, rekey_row_view, remove_row_view, set_all_expanded_view,
    toggle_row_view, ViewState,
};

#[cfg(test)]
mod tests;
