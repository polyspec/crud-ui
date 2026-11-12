"""The code of the package that only its consumers or the standard library use, for vulture (make lint-python)."""

# The public API of Generator and Form (docs/spec/form-runtime.md), which an application calls; the native generator
# program of tests/native-generators/python.py calls each of them.
_.bindButtons
_.formButtonsHtml
_.getRevision
_.getData
_.getValue
_.setData
_.setValue
_.copyRow
_.removeRow
_.moveRow
_.rekeyRow

# The view operation of Form that the form-view fixture test (tests/test_form_state.py) calls by the name of its step.
_.toggleRow

# The handlers of html.parser.HTMLParser that the HTML tree of tests/conformance.py overrides; HTMLParser.feed calls them.
_.handle_starttag
_.handle_startendtag
_.handle_endtag
_.handle_data

# The result of a case that a test sets on Proving, whose __exit__ in tests/conformance/evidence.py records it.
_.passed
