#!/usr/bin/env python3
"""Python target of the native generator checks.

It answers the operation protocol of legacy/tests/native-generators/run.mts through the
public API of polyspec.crudui.generator: one JSON request on standard input,
one JSON response on standard output. A failure answers {error} with the exit
status 1, as the JavaScript, PHP, Go and Rust programs do.
"""

import json
import sys

from polyspec.crudui.generator import FormError, Generator
from polyspec.crudui.validator import ComposeLoadError, FormInputError

FORM_METHODS = frozenset(
    (
        "setData",
        "setValue",
        "addRow",
        "copyRow",
        "removeRow",
        "moveRow",
        "rekeyRow",
        "getValue",
        "getData",
    )
)


def error_record(error):
    """The failure record of a thrown generation or composition failure."""
    at = getattr(error, "path", None)
    if isinstance(error, ComposeLoadError):
        at = ".".join(error.trace)
    if not isinstance(at, str):
        at = ""
    code = getattr(error, "code", None)
    return {
        "code": code if isinstance(code, str) else "INTERNAL_ERROR",
        "message": str(error),
        "at": at,
    }


def is_object(value):
    return isinstance(value, dict)


def own(value, key):
    return key in value


def options_of(request):
    if own(request, "options") and not is_object(request["options"]):
        raise FormInputError("Options must be an object")
    return request.get("options") or {}


def spec_of(request):
    spec = request.get("spec")
    if not is_object(spec):
        raise FormInputError("A form spec must be a group with properties")
    return spec


def template_of(request):
    template = request.get("template")
    if not is_object(template):
        raise FormInputError("Unsupported form template")
    return template


def data_of(request):
    if own(request, "data") and not is_object(request["data"]):
        raise FormInputError("Form data must be an object")
    return request.get("data") or {}


def state(form):
    """The observable state of one form instance: data, fields, markup, revision."""
    return {
        "data": form.getData(),
        "fields": form.getFields(),
        "html": Generator.renderForm(form),
        "revision": form.getRevision(),
    }


def dispatch(request):
    """Answer one operation request."""
    if not is_object(request):
        raise FormInputError("Request must be an object")
    operation = request.get("operation")
    options = options_of(request)
    if operation == "compileForm":
        return Generator.compileForm(spec_of(request), options)
    if operation == "bindForm":
        return Generator.bindForm(template_of(request), data_of(request), options)
    if operation == "bindButtons":
        return Generator.bindButtons(template_of(request), data_of(request), options)
    if operation == "formButtonsHtml":
        return Generator.formButtonsHtml(request.get("buttons"))
    if operation == "buildOutline":
        return Generator.buildOutline(request.get("nodes"))
    if operation == "renderList":
        return Generator.renderList(request.get("spec"), request.get("rows"), options)
    if operation == "buildList":
        return Generator.buildList(request.get("spec"), request.get("rows"), options)
    if operation in ("buildDetail", "renderDetail"):
        record = request["record"] if own(request, "record") else {}
        method = (
            Generator.buildDetail
            if operation == "buildDetail"
            else Generator.renderDetail
        )
        return method(request.get("spec"), record, options)
    if operation == "renderForm":
        form = Generator.createForm(template_of(request), data_of(request), options)
        render = request["render"] if own(request, "render") else {}
        return Generator.renderForm(form, render)
    if operation == "form":
        form = Generator.createForm(template_of(request), data_of(request), options)
        if own(request, "actions") and not isinstance(request.get("actions"), list):
            raise FormInputError("Actions must be an array")
        steps = []
        for action in request.get("actions") or []:
            result = None
            error = None
            try:
                if (
                    not is_object(action)
                    or action.get("method") not in FORM_METHODS
                    or not isinstance(action.get("args"), list)
                ):
                    raise FormInputError("Invalid form action")
                result = getattr(form, action["method"])(*action["args"])
            except (ComposeLoadError, FormInputError, FormError) as caught:
                error = error_record(caught)
            steps.append({"result": result, "error": error, **state(form)})
        return {**state(form), "steps": steps}
    raise FormInputError("Unknown generator operation")


def main():
    try:
        # Standard input that is not UTF-8 is not JSON text; it is never decoded
        # with replacements.
        request = json.loads(sys.stdin.buffer.read().decode("utf-8"))
        response = dispatch(request)
    except UnicodeDecodeError, json.JSONDecodeError:
        error = FormInputError("Request must be valid JSON")
        sys.stdout.write(f"{json.dumps({'error': error_record(error)})}\n")
        raise SystemExit(1)
    except (ComposeLoadError, FormInputError, FormError) as error:
        sys.stdout.write(f"{json.dumps({'error': error_record(error)})}\n")
        raise SystemExit(1)
    sys.stdout.write(f"{json.dumps(response)}\n")


if __name__ == "__main__":
    main()
