# Form choice fixtures
<!-- doc-id: tests-fixtures-form-choices-readme -->

[한국어](README.ko.md).

`cases.json` holds sessions on a form instance whose fields take their choices from a repeated group
([choices from a repeated group](../../../../docs/spec/schema.md#choices-from-a-repeated-group)), for every implementation:
each change of the source rows changes the choices that the next view lists, and no change of the choices changes a
value. The step `choices` with the data path of a field observes the `value` and `label` of each option of that field
node. The case format, the observations and the regeneration are described in [form state](../form-state/README.md).
