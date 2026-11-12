#!/usr/bin/env python3
"""Python validator process of the cross-check console.

It reads one JSON request on standard input, calls the public API of
polyspec.crudui.validator and writes one JSON response on standard output with
the exit status; ../README.md defines the contract, which every program of this
directory shares. A form result exits 0 with {valid, errors, hidden}, a list or
detail result with {valid, errors}. A load or input failure exits 2 with
{error, code, at}. A malformed request exits 1 with exactly {error}.
"""

import json
import sys

from polyspec.crudui.validator import (
    ComposeLoadError,
    FormInputError,
    validate,
    validateDetail,
    validateList,
)
from polyspec.crudui.validator.text import input_failure, specification_failure

MODES = ("form", "list", "detail")


def emit(output, status):
    """Write one JSON line and exit with the given status."""
    sys.stdout.write(f"{json.dumps(output)}\n")
    raise SystemExit(status)


def reject(message):
    """Answer a malformed request."""
    emit({"error": message}, 1)


def is_object(value):
    return isinstance(value, dict)


def main():
    # Standard input that is not UTF-8 is not JSON text; it is never decoded
    # with replacements. The JSON reader keeps an unpaired surrogate escape as
    # text the validator rejects instead of failing like strict decoding.
    raw = sys.stdin.buffer.read()
    try:
        request = json.loads(raw.decode("utf-8"))
    except UnicodeDecodeError, json.JSONDecodeError:
        reject("Request must be valid JSON")
    if not is_object(request):
        reject("Request must be an object")
    spec = request.get("spec")
    if not is_object(spec):
        reject("Request spec must be an object")
    mode = request.get("mode", "form")
    if not (isinstance(mode, str) and mode in MODES):
        reject("Unsupported validation mode")
    files = request.get("files")
    if files is not None and not is_object(files):
        reject("Request files must be an object")
    if files is not None and not all(is_object(file) for file in files.values()):
        reject("Request files must contain objects")
    basepath = request.get("basepath")
    if basepath is not None and not isinstance(basepath, str):
        reject("Request basepath must be a string")

    options = {
        "files": files if files is not None else {},
        "basepath": basepath if basepath is not None else "",
    }
    try:
        if mode == "list":
            emit(_clean(validateList(spec, options)), 0)
        elif mode == "detail":
            emit(_clean(validateDetail(spec, options)), 0)
        else:
            data = request["data"] if "data" in request else {}
            if not is_object(data):
                # The Python API takes only an object, so the input text rules
                # that precede the data shape rule are applied here in the
                # library's order.
                failure = specification_failure(spec, options["files"])
                failure = failure or input_failure(
                    [("data", data), ("options.basepath", options["basepath"])]
                )
                raise FormInputError(failure or "Form data must be an object")
            result = validate(spec, data, options)
            emit(
                {
                    "valid": result["valid"],
                    "errors": result["errors"],
                    "hidden": result["hidden"],
                },
                0,
            )
    except ComposeLoadError as error:
        emit({"error": str(error), "code": error.code, "at": ".".join(error.trace)}, 2)
    except FormInputError as error:
        emit({"error": str(error), "code": error.code, "at": ""}, 2)
    except SystemExit:
        raise
    except Exception as error:  # noqa: BLE001 - the contract answers every failure
        emit({"error": str(error)}, 1)


def _clean(result):
    """The response of a list or detail result, without the hidden paths."""
    return {"valid": result["valid"], "errors": result["errors"]}


if __name__ == "__main__":
    main()
