# CRUDUI Python generator
<!-- doc-id: packages-generator-python-readme -->
<!-- source-sha256: e25529ef4d5d6dc1917c36fa33448bbf6a5cd87af86042c14373e092a5f84abd -->

[English](README.md).

Python으로 form template을 compile하고 데이터를 묶어 form·list·detail을 그린다.

```sh
python3 -m unittest discover -s legacy/packages/generator/python/tests -p 'test_*.py'
```

## 공개 API

```python
from polyspec.crudui.generator import Generator

spec = {"type": "group", "properties": {"name": {"type": "text", "label": "Name"}}}
template = Generator.compileForm(spec)
form = Generator.createForm(template, {"name": "Ada"})
html = Generator.renderForm(form)
```

`Generator.compileForm(spec, options)`는 명세를 record 데이터 없이
JSON 직렬화 가능한 template으로 compile한다. `bindForm`은 데이터를 template의
필드에 묶고, `bindButtons`은 record의 button을 평가하며, `formButtonsHtml`은
평가된 button을 모든 renderer가 form footer에 놓는 markup으로 그린다.
`createForm`은 복사한 template 위의 독립된 form instance(`Form`)를 만들며,
그 row 연산 `addRow`·`copyRow`·`removeRow`·`moveRow`·`rekeyRow`, 값 연산
`getValue`·`setValue`·`setData`, getter가 `renderForm`에 들어간다.
`renderList`는 주어진 행을 table·card layout으로 그리고 `buildList`는 읽기 전용
list model을 만든다. `renderDetail`와 `buildDetail`은 하나의 record에 대해 같은
일을 한다. `buildOutline`은 평가된 node의 구조 지도 행을 만든다. `sequenceRowKey`는 음이 아닌 순번을 13자리 10진수로 만들고
`createRowKey`는 13자 16진수 row key를 만든다.

생성 실패는 code `INVALID_FORM_INPUT` 또는 `UNSUPPORTED_FIELD_TYPE`의
`FormError`를 일으키고, 명세 composition 실패는
`polyspec.crudui.validator`의 `ComposeLoadError`와 `FormInputError`를
일으킨다. dictionary는 object를, list는 array를 나타내며 모든 문자열은 정확한
code point를 유지하고 호출자가 넘긴 짝 없는 surrogate는 생성 전에 거부된다.
이 module은 namespace package `polyspec.crudui.generator`를 선언하며
Python 3.11 이상에서 `polyspec-crudui-validator` 외에는 표준 라이브러리만
쓴다.

단위 test는 `legacy/tests/fixtures`의 공통 fixture를 읽는다. `form-render`(188),
`list-render`(157), `detail-render`(62), `form-complete`(28), 그리고
`text-validity`의 `compileForm`·`bindForm`·`createForm`·`buildList`·
`buildDetail` 파일의 모든 사례를 다룬다. [기능 상태](../../../../docs/features.md)는
발행과 별개로 현재 검증 상태를 기록한다.
