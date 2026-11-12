# CRUDUI Python 검증기
<!-- doc-id: packages-validator-python-readme -->
<!-- source-sha256: 8af9a8bc08f6c45ffb7011cf54084ab45c6bb3e56f257713db3ce58071e0688c -->

[English](README.md).

명세를 compose하고 식을 평가하며 데이터를 검증한다.

```sh
python3 -m unittest discover -s legacy/packages/validator/python/tests -p 'test_*.py'
```

## Public API

```python
from polyspec.crudui.validator import ComposeLoadError, FormInputError, validate

spec = {
    "type": "group",
    "properties": {"name": {"type": "text", "validate": {"required": True}}},
}
result = validate(spec, {"name": "Ada"})
assert result["valid"]
```

`validate(spec, data, options)`는 명세를 compose하고 지원하지 않는 metadata를 검사한 뒤
제출된 데이터를 검증한다. `validateList`는 list 명세의 composition과 metadata를 검사하며
행은 검증하지 않는다. `validateDetail`은 detail 명세의 composition을 root와 `fields`
map의 `$ref`, `$patch`까지 검사하고 metadata를 검사하며 record는 검증하지 않는다. 둘 다
정상 적재면 `{'valid': True, 'errors': []}`를 반환한다. options는 `files`(composition
문서의 map)와 `basepath`를 받는다. composition 실패는 `ComposeLoadError`를 일으키며
`code`는 이유를, `trace`는 명세 경로를 이름한다. 모양이나 text가 잘못된 제출 데이터는
code `INVALID_FORM_INPUT`의 `FormInputError`를 일으킨다.

결과와 오류 항목은 dictionary다. `errors`는 `path`, `field`, `rule`, `message`,
`value` 기록의 list다. dictionary가 object를, list가 array를 나타내며 모든 문자열은
정확한 code point를 유지하고 호출자가 넘긴 unpaired surrogate는 검증 전에 거부된다.
module은 namespace package `polyspec.crudui.validator`를 선언하고 Python 3.11 이상에서
표준 라이브러리만 쓴다.

단위 test는 `legacy/tests/fixtures`의 공통 fixture를 읽는다. `validate`(309), `expr`(54),
`compose`(20), `spec-validity`(34), `list-validity`(20), `detail-validity`(13)와
`text-validity`의 `validate`, `validateList`, `validateDetail` 파일과
`value-graphs.json`의 모든 사례를 검증한다. [기능 상태](../../../../docs/features.ko.md)는
현재 검증과 배포를 별도로 기록한다.
