"""Editable data and evaluated fields for one compiled structure.

An instance holds a detached copy of the template, its normalized data and
its evaluated fields and buttons. Every data update reevaluates them
atomically: the update applies only when its normalization and evaluation
both succeed, and the revision counts the successful updates.
"""

import re
import secrets
from typing import Any, NoReturn

from .binding import bind as bind_fields
from .binding import language as bind_language
from . import buttons as buttons_module
from . import history as history_module
from . import view as view_module
from .errors import FormError
from .input_text import inputs as check_inputs
from .messages import for_language
from .template import checked as checked_template
from .value import (
    MISSING,
    copy_value,
    get,
    object_value,
    path as value_path,
    segments,
    translate,
)

__all__ = ["Form"]

_KEY_PATTERN = re.compile(r"^[A-Za-z0-9_-]+$")
_DIGITS = re.compile(r"^\d+$")
_SEQUENCE = re.compile(r"^\d{1,13}$")
# The key of the one initial row that missing repeated data creates (CUEC-002).
_INITIAL_ROW_KEY = "__0000000000000__"


def _copy(value: Any) -> Any:
    """A detached copy of a dynamic record value."""
    return copy_value(value)


def sequenceRowKey(sequence: object) -> str:
    """A nonnegative sequence with thirteen decimal digits."""
    text = str(sequence)
    if _SEQUENCE.match(text) is None:
        raise FormError(
            "INVALID_FORM_INPUT", "A sequence must contain 1–13 decimal digits"
        )
    return f"__{text.zfill(13)}__"


def createRowKey() -> str:
    """A thirteen-character hexadecimal row key."""
    return f"__{secrets.token_hex(7)[:13]}__"


class Form:
    """One instance over a compiled template."""

    def __init__(self, template: Any, data: Any = None, options: Any = None) -> None:
        options = options or {}
        check_inputs(
            [("template", template), ("data", data if data is not None else {})],
            options,
            ("idPrefix", "keyPrefix", "language", "unsupported"),
        )
        self._template = checked_template(template)
        self._options = options
        self._data = self._normalize_fields(
            self._template["fields"], object_value(data if data is not None else {})
        )
        self._view = view_module.initial()
        self._fields = bind_fields(
            self._template, self._data, self._bind_options(self._view)
        )
        self._buttons = buttons_module.bind(
            self._template, self._data, self._language()
        )
        self._history = history_module.empty()
        self._revision = 0

    # -- Readers -------------------------------------------------------------

    def getTemplate(self) -> Any:
        """A detached copy of the compiled template."""
        return _copy(self._template)

    def getFields(self) -> Any:
        """Detached evaluated field models."""
        return _copy(self._fields)

    def getButtons(self) -> Any:
        """Detached evaluated form buttons."""
        return _copy(self._buttons)

    def getMessages(self) -> Any:
        """The interface text for the instance language."""
        return for_language(self._language())

    def getDescription(self) -> Any:
        """The template's root description for the instance language; empty text when none."""
        return translate(self._template.get("description"), self._language())

    def getRevision(self) -> Any:
        """The number of successful data updates."""
        return self._revision

    def getData(self) -> Any:
        """Detached submission data."""
        return _copy(self._data)

    def canUndo(self) -> bool:
        """Whether `undo` can restore an earlier record (CURT-061)."""
        return history_module.can_undo(self._history)

    def canRedo(self) -> bool:
        """Whether `redo` can reapply an undone change (CURT-061)."""
        return history_module.can_redo(self._history)

    def getValue(self, path: Any) -> Any:
        """A detached path value, or None when missing."""
        check_inputs([("path", path)])
        self._checked_path(path)
        value = value_path(self._data, path)
        return None if value is MISSING else _copy(value)

    # -- Writers -------------------------------------------------------------

    def setData(self, data: Any) -> None:
        """Replace the record and reevaluate the fields atomically."""
        check_inputs([("data", data)])
        if not isinstance(data, dict):
            raise FormError("INVALID_FORM_INPUT", "Form data must be an object")
        self._commit(
            self._normalize_fields(self._template["fields"], object_value(data)),
            view_module.initial(),
            reset=True,
        )

    def setValue(self, path: Any, value: Any) -> None:
        """Replace one path value and reevaluate the fields atomically."""
        check_inputs([("path", path), ("value", value)])
        parts = self._checked_path(path)
        data = self._put(self._data, parts, _copy(value))
        self._commit(
            self._normalize_fields(self._template["fields"], data),
            path=".".join(parts),
        )

    def undo(self) -> None:
        """Restore the record before the last data change; the view state stays (CURT-011)."""
        change = history_module.undo(self._history, self._data)
        self._install(change["value"], self._view, change["history"])

    def redo(self) -> None:
        """Reapply the most recently undone data change (CURT-012)."""
        change = history_module.redo(self._history, self._data)
        self._install(change["value"], self._view, change["history"])

    def addRow(self, path: Any, options: Any = None) -> Any:
        """Insert one supplied or defaulted row and return its key."""
        options = options or {}
        check_inputs([("path", path)], options, ("afterKey", "key", "value"))
        field, rows = self._editable_collection(path)
        maximum = (
            (field["spec"].get("multiple") or {}).get("max")
            if isinstance(field["spec"].get("multiple"), dict)
            else None
        )
        if isinstance(maximum, (int, float)) and len(rows) >= maximum:
            self._fail(f"Maximum row count reached: {path}")
        key = options["key"] if "key" in options else self._fresh_key(list(rows))
        if not isinstance(key, str):
            self._fail("A row key must be a string")
        self._check_key(key)
        if key in rows:
            self._fail(f"Row key already exists: {key}")
        members = list(rows)
        index = len(members)
        if "afterKey" in options:
            if options["afterKey"] not in members:
                self._fail(f"Unknown row: {_scalar(options['afterKey'])}")
            index = members.index(options["afterKey"]) + 1
        value = self._normalize_row(
            field,
            _copy(options["value"]) if "value" in options else MISSING,
            ".".join([*self._checked_path(path), key]),
            fresh=True,
        )
        items = list(rows.items())
        following = dict(items[:index])
        following[key] = value
        following.update(items[index:])
        self._commit(self._put(self._data, self._checked_path(path), following))
        return key

    def copyRow(self, path: Any, key: Any, options: Any = None) -> Any:
        """Copy current row values and regenerate nested repeated keys."""
        options = dict(options or {})
        check_inputs([("path", path), ("key", key)], options, ("afterKey", "key"))
        field, rows = self._editable_collection(path)
        if key not in rows:
            self._fail(f"Unknown row: {key}")
        options.setdefault("afterKey", key)
        options["value"] = self._copy_row_value(field, rows[key])
        return self.addRow(path, options)

    def removeRow(self, path: Any, key: Any) -> None:
        """Remove one row while respecting the minimum count."""
        check_inputs([("path", path), ("key", key)])
        field, rows = self._editable_collection(path)
        if key not in rows:
            self._fail(f"Unknown row: {key}")
        minimum = (
            (field["spec"].get("multiple") or {}).get("min")
            if isinstance(field["spec"].get("multiple"), dict)
            else None
        )
        if isinstance(minimum, (int, float)) and len(rows) <= minimum:
            self._fail(f"Minimum row count reached: {path}")
        following = dict(rows)
        del following[key]
        self._commit(
            self._put(self._data, self._checked_path(path), following),
            view_module.remove_row(
                self._view, ".".join([*self._checked_path(path), key])
            ),
        )

    def moveRow(self, path: Any, key: Any, index: Any) -> None:
        """Change row order without changing row identity."""
        check_inputs([("path", path), ("key", key)])
        _field, rows = self._editable_collection(path)
        if key not in rows:
            self._fail(f"Unknown row: {key}")
        members = list(rows)
        if index < 0 or index >= len(members):
            self._fail(f"Invalid row position: {index}")
        if members.index(key) == index:
            return
        remaining = dict(rows)
        value = remaining.pop(key)
        items = list(remaining.items())
        following = dict(items[:index])
        following[key] = value
        following.update(items[index:])
        self._commit(self._put(self._data, self._checked_path(path), following))

    def rekeyRow(self, path: Any, old_key: Any, new_key: Any) -> None:
        """Replace one row key and regenerate descendant field paths."""
        check_inputs([("path", path), ("oldKey", old_key), ("newKey", new_key)])
        _field, rows = self._editable_collection(path)
        self._check_key(new_key)
        if old_key not in rows:
            self._fail(f"Unknown row: {old_key}")
        if old_key == new_key:
            return
        if new_key in rows:
            self._fail(f"Row key already exists: {new_key}")
        following = {
            (new_key if key == old_key else key): value for key, value in rows.items()
        }
        parts = self._checked_path(path)
        self._commit(
            self._put(self._data, parts, following),
            view_module.rekey_row(
                self._view, ".".join([*parts, old_key]), ".".join([*parts, new_key])
            ),
        )

    def toggleRow(self, path: Any, key: Any) -> None:
        """Expand or collapse one row; the record and the revision do not change."""
        check_inputs([("path", path), ("key", key)])
        _field, rows = self._collection(path)
        if key not in rows:
            self._fail(f"Unknown row: {key}")
        self._refresh_view(
            view_module.toggle(self._view, ".".join([*self._checked_path(path), key]))
        )

    def setAllExpanded(self, expanded: Any) -> None:
        """Expand every row, or collapse every collapsible row."""
        self._refresh_view(view_module.set_all_expanded(self._fields, expanded is True))

    # -- Internals -----------------------------------------------------------

    def _bind_options(self, view: Any) -> Any:
        return {**self._options, "collapsed": list(view["collapsed"])}

    def _refresh_view(self, view: Any) -> None:
        self._fields = bind_fields(self._template, self._data, self._bind_options(view))
        self._view = view

    def _commit(
        self, data: Any, view: Any = None, path: Any = None, reset: bool = False
    ) -> None:
        """Apply one data change; `path` is the value edit it records, `reset` clears the history."""
        view = self._view if view is None else view
        history = (
            history_module.empty()
            if reset
            else history_module.record(self._history, self._data, path)
        )
        self._install(data, view, history)

    def _install(self, data: Any, view: Any, history: Any) -> None:
        """Evaluate the record and the view, then replace the state; the revision counts it."""
        fields = bind_fields(self._template, data, self._bind_options(view))
        buttons = buttons_module.bind(self._template, data, self._language())
        self._view = view
        self._data = data
        self._fields = fields
        self._buttons = buttons
        self._history = history
        self._revision += 1

    def _language(self) -> Any:
        return bind_language(self._options)

    @staticmethod
    def _checked_path(path: Any) -> Any:
        parts = segments(path)
        if not parts or any(
            part in ("__proto__", "prototype", "constructor") for part in parts
        ):
            Form._fail(f"Invalid form path: {path}")
        return parts

    @staticmethod
    def _check_key(key: Any) -> None:
        if (
            _KEY_PATTERN.match(key) is None
            or _DIGITS.match(key) is not None
            or key in ("__proto__", "prototype", "constructor")
        ):
            Form._fail(f"Invalid row key: {key}; use sequenceRowKey for numeric ids")

    @staticmethod
    def _put(data: Any, path: Any, value: Any) -> Any:
        head, rest = path[0], path[1:]
        out = dict(data)
        if rest:
            out[head] = Form._put(
                data.get(head) if isinstance(data.get(head), dict) else {}, rest, value
            )
        else:
            out[head] = value
        return out

    @staticmethod
    def _repeats(field: Any) -> bool:
        multiple = field["spec"].get("multiple")
        return multiple is True or Form._data_only(field) or isinstance(multiple, dict)

    @staticmethod
    def _data_only(field: Any) -> bool:
        """A `multiple: only` collection: its rows come only from the data."""
        multiple = field["spec"].get("multiple")
        return multiple == "only" or (
            isinstance(multiple, dict) and multiple.get("only") is True
        )

    @staticmethod
    def _fresh_key(used: Any) -> str:
        for _attempt in range(100):
            key = createRowKey()
            if key not in used:
                return key
        Form._fail("Unable to generate an unused row key")

    def _normalize_fields(
        self, fields: Any, value: Any, path: str = "", fresh: bool = False
    ) -> Any:
        """Normalize record data; `path` is the full data path, empty at the root.

        Missing repeated data gets the initial row `__0000000000000__`; a row that an operation creates
        (`fresh`) gets a fresh key instead, as the TypeScript reference does (instance.ts normalizeFields).
        """
        if value is not MISSING and not isinstance(value, dict):
            self._fail(
                "Form data must be an object"
                if path == ""
                else f"Group data must be an object: {path}"
            )
        data: dict[str, Any] = {} if value is MISSING else _copy(value)
        for field in fields:
            raw = get(data, field["name"])
            field_path = field["name"] if path == "" else f"{path}.{field['name']}"
            if self._repeats(field):
                if raw is not MISSING and not isinstance(raw, dict):
                    self._fail(f"Repeated data must be a keyed object: {field_path}")
                rows: dict[Any, Any] = {}
                entries: dict[str, Any] = (
                    raw
                    if isinstance(raw, dict)
                    else (
                        {}
                        if self._data_only(field)
                        else {
                            (
                                self._fresh_key([]) if fresh else _INITIAL_ROW_KEY
                            ): MISSING
                        }
                    )
                )
                for key, row in entries.items():
                    self._check_key(str(key))
                    rows[key] = self._normalize_row(
                        field, row, f"{field_path}.{key}", fresh
                    )
                data[field["name"]] = rows
            elif field["spec"].get("type") == "group":
                data[field["name"]] = self._normalize_fields(
                    field["children"], raw, field_path, fresh
                )
            elif raw is MISSING and "default" in field["spec"]:
                data[field["name"]] = _copy(field["spec"]["default"])
        return data

    def _normalize_row(
        self, field: Any, value: Any, path: str, fresh: bool = False
    ) -> Any:
        if field["spec"].get("type") == "group":
            return self._normalize_fields(field["children"], value, path, fresh)
        if value is MISSING:
            return _copy(field["spec"]["default"]) if "default" in field["spec"] else ""
        return _copy(value)

    def _copy_row_value(self, field: Any, value: Any) -> Any:
        if field["spec"].get("type") == "group":
            return self._copy_children(field["children"], _copy(value))
        return _copy(value)

    def _copy_children(self, fields: Any, value: Any) -> Any:
        for field in fields:
            raw = value.get(field["name"])
            if self._repeats(field) and isinstance(raw, dict):
                used = list(raw)
                following = {}
                for row in raw.values():
                    key = self._fresh_key(used)
                    used.append(key)
                    following[key] = self._copy_row_value(field, row)
                value[field["name"]] = following
            elif field["spec"].get("type") == "group" and isinstance(raw, dict):
                value[field["name"]] = self._copy_children(field["children"], raw)
        return value

    def _editable_collection(self, path: Any) -> Any:
        """A collection whose rows the form may add, copy, remove, move or rekey."""
        field, rows = self._collection(path)
        if self._data_only(field):
            self._fail(f"Rows of {path} come only from data")
        return field, rows

    def _collection(self, path: Any) -> Any:
        segments_list = self._checked_path(path)
        fields = self._template["fields"]
        field = None
        index = 0
        while index < len(segments_list):
            field = None
            for candidate in fields:
                if candidate["name"] == segments_list[index]:
                    field = candidate
                    break
            if field is None:
                self._fail(f"Unknown collection: {path}")
            if index == len(segments_list) - 1:
                break
            if self._repeats(field):
                index += 1
            fields = field["children"]
            field = None
            index += 1
        rows = value_path(self._data, path)
        if field is None or not self._repeats(field) or not isinstance(rows, dict):
            self._fail(f"Not a keyed collection: {path}")
        return field, rows

    @staticmethod
    def _fail(message: str) -> NoReturn:
        raise FormError("INVALID_FORM_INPUT", message)


def _scalar(value: Any) -> Any:
    from .value import scalar

    return scalar(value)
