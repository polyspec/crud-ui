"""Compile form structures, bind values and render forms or lists.

`Generator` holds the operations of the four passes: compile a specification
into a template, bind data to the fields of a template, create a form
instance, and render a form, a list or a detail. The failures it raises are
`FormError` with `INVALID_FORM_INPUT` or `UNSUPPORTED_FIELD_TYPE`, and the
composition failures of `polyspec.crudui.validator`.
"""

from collections.abc import Mapping
from typing import Any

from polyspec.crudui.validator.jsvalue import JsonValue

from .actions import resolveAction as _resolve_action
from .actions import runAction as _run_action
from .binding import bind as _bind_fields
from . import buttons as _buttons
from . import view as _view
from .details import build as _detail_build
from .details import render as _detail_render
from .errors import FormError
from .form import Form, createRowKey, sequenceRowKey
from .form_render import model as _render_model
from . import history as _history
from .input_text import inputs as _check_inputs
from .input_text import specification as _check_specification
from .lists import build_public as _list_build
from .lists import render as _list_render
from .outline import build as _outline_build
from .rendering import form as _render_form
from .template import compile as _template_compile

__all__ = ["Form", "FormError", "Generator"]


class Generator:
    """The public operations over specifications, templates and instances."""

    @staticmethod
    def compileForm(spec: Any, options: Mapping[str, Any] | None = None) -> Any:
        """A JSON-serializable structure without record data."""
        options = options or {}
        _check_specification(spec, options)
        _check_inputs([], options, ("basepath", "keyPrefix"))
        return _template_compile(spec, options)

    @staticmethod
    def bindForm(
        template: Any,
        data: JsonValue | None = None,
        options: Mapping[str, Any] | None = None,
    ) -> Any:
        """Evaluated fields without modifying the template or the record data.

        The option `collapsed` lists the row paths `{collection}.{key}` rendered collapsed.
        """
        options = options or {}
        _check_inputs(
            [("template", template), ("data", data if data is not None else {})],
            options,
            ("idPrefix", "keyPrefix", "language", "unsupported"),
        )
        return _bind_fields(template, data if data is not None else {}, options)

    @staticmethod
    def initialView() -> Any:
        """The view with no collapsed row; a view is `{"collapsed": [row paths]}`."""
        return _view.initial()

    @staticmethod
    def toggleRowView(view: Any, rowPath: str) -> Any:
        """Expand a collapsed row or collapse an expanded one."""
        return _view.toggle(view, rowPath)

    @staticmethod
    def collapsibleRows(nodes: Any) -> Any:
        """The row paths `{collection}.{key}` of every collapsible row of the evaluated nodes."""
        return _view.collapsible_rows(nodes)

    @staticmethod
    def setAllExpandedView(nodes: Any, expanded: bool) -> Any:
        """The view with no collapsed row, or with every collapsible row collapsed."""
        return _view.set_all_expanded(nodes, expanded)

    @staticmethod
    def removeRowView(view: Any, rowPath: str) -> Any:
        """Drop the collapsed state of a removed row and of the rows inside it."""
        return _view.remove_row(view, rowPath)

    @staticmethod
    def rekeyRowView(view: Any, oldPath: str, newPath: str) -> Any:
        """Move the collapsed state of a rekeyed row and of the rows inside it."""
        return _view.rekey_row(view, oldPath, newPath)

    @staticmethod
    def bindButtons(
        template: Any,
        data: JsonValue | None = None,
        options: Mapping[str, Any] | None = None,
    ) -> Any:
        """The template buttons for a record, with type, tag, text and ordered attrs."""
        options = options or {}
        _check_inputs(
            [("template", template), ("data", data if data is not None else {})],
            options,
            ("idPrefix", "keyPrefix", "language", "unsupported"),
        )
        return _buttons.bind_public(template, data if data is not None else {}, options)

    @staticmethod
    def formButtonsHtml(buttons: Any) -> Any:
        """Evaluated buttons as the markup every renderer places in the form footer.

        Any other element is rejected.
        """
        return _buttons.html_public(buttons)

    @staticmethod
    def createForm(
        template: Any,
        data: JsonValue | None = None,
        options: Mapping[str, Any] | None = None,
    ) -> Any:
        """An independent form instance over a copied template."""
        return Form(template, data, options)

    @staticmethod
    def emptyHistory() -> dict[str, Any]:
        """A history with nothing to undo (CURT-011)."""
        return _history.empty()

    @staticmethod
    def recordChange(
        history: Mapping[str, Any], previous: Any, path: str | None = None
    ) -> dict[str, Any]:
        """The history after a change from `previous`, with at most 100 records in each direction (CURT-011)."""
        return _history.record(history, previous, path)

    @staticmethod
    def canUndo(history: Mapping[str, Any]) -> bool:
        """Whether a record can be restored (CURT-011)."""
        return _history.can_undo(history)

    @staticmethod
    def canRedo(history: Mapping[str, Any]) -> bool:
        """Whether an undone change can be reapplied (CURT-012)."""
        return _history.can_redo(history)

    @staticmethod
    def undoChange(history: Mapping[str, Any], current: Any) -> dict[str, Any]:
        """The history and the record before the last change; `FormError` when there is none (CURT-011)."""
        return _history.undo(history, current)

    @staticmethod
    def redoChange(history: Mapping[str, Any], current: Any) -> dict[str, Any]:
        """The history and the record after the last undone change; `FormError` when there is none (CURT-012)."""
        return _history.redo(history, current)

    @staticmethod
    def renderForm(form: Any, options: Mapping[str, Any] | None = None) -> Any:
        """The current instance as the complete form.

        `options` may carry action, hidden, formErrors and errors members; an
        option outside the contract is a `FormError`.
        """
        options = {} if options is None else options
        fields = form.getFields()
        model = _render_model(fields, form.getTemplate().get("action"), options)
        return _render_form(
            fields, form.getButtons(), form.getMessages(), model, form.getDescription()
        )

    @staticmethod
    def renderList(
        spec: Any, rows: JsonValue, options: Mapping[str, Any] | None = None
    ) -> Any:
        """Supplied list rows with the table or card layout."""
        options = options or {}
        rows = [] if rows is None else rows
        _display_checks(spec, ("rows", rows), options)
        return _list_render(spec, rows, options)

    @staticmethod
    def buildList(
        spec: Any,
        rows: JsonValue | None = None,
        options: Mapping[str, Any] | None = None,
    ) -> Any:
        """One read-only list model from supplied rows."""
        options = options or {}
        rows = [] if rows is None else rows
        _display_checks(spec, ("rows", rows), options)
        return _list_build(spec, rows, options)

    @staticmethod
    def renderDetail(
        spec: Any,
        record: JsonValue | None = None,
        options: Mapping[str, Any] | None = None,
    ) -> Any:
        """One read-only detail from a supplied record."""
        options = options or {}
        _display_checks(spec, ("record", record if record is not None else {}), options)
        return _detail_render(spec, record, options)

    @staticmethod
    def buildDetail(
        spec: Any,
        record: JsonValue | None = None,
        options: Mapping[str, Any] | None = None,
    ) -> Any:
        """One read-only detail model from a supplied record."""
        options = options or {}
        _display_checks(spec, ("record", record if record is not None else {}), options)
        return _detail_build(spec, record, options)

    @staticmethod
    def buildOutline(nodes: Any) -> Any:
        """The structure map of evaluated nodes: the form's rows, nested as in the form."""
        return _outline_build(nodes)

    @staticmethod
    def sequenceRowKey(sequence: Any) -> Any:
        """A nonnegative sequence formatted with thirteen decimal digits."""
        return sequenceRowKey(sequence)

    @staticmethod
    def createRowKey() -> Any:
        """A thirteen-character hexadecimal row key."""
        return createRowKey()

    @staticmethod
    def resolveAction(source: Any) -> Any:
        """The target `{name, path?, key?}` of an action button, or None for an unknown action (CURT-081)."""
        return _resolve_action(source)

    @staticmethod
    def runAction(form: Any, target: Any) -> Any:
        """Run a resolved action on a form instance and return its focus target (CURT-082 to CURT-090)."""
        return _run_action(form, target)


def _display_checks(spec: Any, entry: Any, options: Mapping[str, Any]) -> Any:
    """Input text of a list or detail operation: the specification and files,
    then the rows or record, then the display options."""
    _check_specification(spec, options)
    _check_inputs([entry], options, ("basepath", "data", "language", "layout"))
