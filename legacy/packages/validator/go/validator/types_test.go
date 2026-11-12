package validator

import (
	"bytes"
	"encoding/json"
	"os"
	"reflect"
	"slices"
	"strings"
	"testing"
)

// roundTrip parses JSON into a FieldSpec, re-serializes, and asserts byte
// equality against the compacted input. It is the cross-language round-trip
// contract: the 4 languages must parse → re-emit the same model JSON.
func roundTrip(t *testing.T, in string) {
	t.Helper()
	var f FieldSpec
	if err := json.Unmarshal([]byte(in), &f); err != nil {
		t.Fatalf("unmarshal: %v\ninput: %s", err, in)
	}
	out, err := json.Marshal(&f)
	if err != nil {
		t.Fatalf("marshal: %v", err)
	}
	var want bytes.Buffer
	if err := json.Compact(&want, []byte(in)); err != nil {
		t.Fatalf("compact: %v", err)
	}
	if string(out) != want.String() {
		t.Fatalf("round-trip mismatch\n want: %s\n got:  %s", want.String(), out)
	}
}

func TestRoundTripTopLevelAndContent(t *testing.T) {
	roundTrip(t, `{"type":"email","name":"contact","default":"a@b.c"}`)
	roundTrip(t, `{"label":"Email","help":"plain"}`)
	roundTrip(t, `{"label":{"ko":"이름","en":"Name"},"description":{"ko":"설명"}}`)
	roundTrip(t, `{"placeholder":"enter","prepend":"$","append":"USD"}`)
}

func TestRoundTripPropertiesOrderPreserved(t *testing.T) {
	in := `{"type":"group","properties":{"z":{"type":"text"},"a":{"type":"number"},"m":{"type":"email"}}}`
	roundTrip(t, in)

	var f FieldSpec
	if err := json.Unmarshal([]byte(in), &f); err != nil {
		t.Fatal(err)
	}
	if got := strings.Join(f.Properties.Keys, ","); got != "z,a,m" {
		t.Fatalf("declaration order lost: %s", got)
	}
}

func TestRoundTripSlotPolymorphism(t *testing.T) {
	// false | {} | true for each role slot and structure key.
	roundTrip(t, `{"validate":false}`)
	roundTrip(t, `{"validate":true}`)
	roundTrip(t, `{"validate":{"required":true,"email":true,"match":".other"}}`)
	roundTrip(t, `{"validate":{"required":".subscribe"}}`)

	roundTrip(t, `{"design":false}`)
	roundTrip(t, `{"design":true}`)
	roundTrip(t, `{"design":{"show":".enabled","class":"col","style":"x","label":{"class":"lc"},"prepend":{"style":"ps"}}}`)

	roundTrip(t, `{"behavior":false}`)
	roundTrip(t, `{"behavior":true}`)
	roundTrip(t, `{"behavior":{"onchange":"f()","onclick":"g()","onload":"h()"}}`)

	roundTrip(t, `{"multiple":false}`)
	roundTrip(t, `{"multiple":true}`)
	roundTrip(t, `{"multiple":{"min":1,"max":5,"copy":true,"sortable":true,"title":"name","controls":"footer","header":"sticky","onclick":"add()"}}`)
	roundTrip(t, `{"multiple":"only"}`)
	roundTrip(t, `{"multiple":{"only":true,"title":"name","header":"sticky"}}`)

	roundTrip(t, `{"lang":false}`)
	roundTrip(t, `{"lang":true}`)
	roundTrip(t, `{"lang":{"mode":"append","only":["ko","en"],"name":"n","key":"k","frame":true,"title":"t","group_class":"g"}}`)
}

func TestRoundTripItemsPolymorphism(t *testing.T) {
	roundTrip(t, `{"items":["a","b","c"]}`)
	roundTrip(t, `{"items":{"model":"User","method":"all","table":"users","relations":"role"}}`)
	// Dynamic source (type: search): api_server (runtime HTTP fn) +
	// placeholder static items coexist under items. Structure only; preserved
	// verbatim, never resolved.
	roundTrip(t, `{"type":"search","items":{"api_server":"function() { return '../search'; }","items":[]}}`)
	// Nested model {table,relations,keys} + sibling api_server +
	// placeholder value→label items, all under items.
	roundTrip(t, `{"type":"search","items":{"model":{"table":"service_member","relations":[{"table":"user","left":"user_seq","right":"seq"}],"keys":[{"table":"service_member","field":"seq","append":". "}]},"api_server":"function() { return '/admin/user/search'; }","items":{"":"선택하세요"}}}`)
}

func TestRoundTripOptionsExtra(t *testing.T) {
	roundTrip(t, `{"options":false}`)
	roundTrip(t, `{"options":true}`)
	// Named keys only; map iteration over Extra would break byte equality, so
	// Extra round-trip is asserted structurally below, not byte-for-byte.
	roundTrip(t, `{"options":{"max_tags":3,"checkbox_label":"agree","stepper":true}}`)
}

func TestOptionsExtraStructuralRoundTrip(t *testing.T) {
	in := `{"options":{"max_tags":3,"custom_widget_key":{"nested":1},"another":"v"}}`
	var f FieldSpec
	if err := json.Unmarshal([]byte(in), &f); err != nil {
		t.Fatal(err)
	}
	if f.Options.Extra["another"] != "v" {
		t.Fatalf("Extra not captured: %#v", f.Options.Extra)
	}
	if _, ok := f.Options.Extra["custom_widget_key"]; !ok {
		t.Fatalf("nested Extra key dropped")
	}
	out, err := json.Marshal(&f)
	if err != nil {
		t.Fatal(err)
	}
	var got FieldSpec
	if err := json.Unmarshal(out, &got); err != nil {
		t.Fatal(err)
	}
	if got.Options.Extra["another"] != "v" || got.Options.MaxTags != float64(3) {
		t.Fatalf("structural round-trip lost data: %#v", got.Options)
	}
}

func TestRoundTripConditionMapOrder(t *testing.T) {
	in := `{".vip":"gold",".member":"silver","true":"bronze"}`
	var c ConditionMap
	if err := json.Unmarshal([]byte(in), &c); err != nil {
		t.Fatal(err)
	}
	if got := strings.Join(c.Keys, "|"); got != ".vip|.member|true" {
		t.Fatalf("condition order lost: %s", got)
	}
	out, err := json.Marshal(&c)
	if err != nil {
		t.Fatal(err)
	}
	if string(out) != in {
		t.Fatalf("condition round-trip mismatch: %s", out)
	}
}

func TestForbiddenMetaKeysRejectedAtTopLevel(t *testing.T) {
	for _, k := range ForbiddenMetaKeys {
		in := `{"` + k + `":true}`
		var f FieldSpec
		if err := json.Unmarshal([]byte(in), &f); err == nil {
			t.Fatalf("top-level forbidden key %q accepted", k)
		}
	}
}

func TestForbiddenMetaKeysRejectedUnderOpenBucket(t *testing.T) {
	// One level under options (the open Extra bucket) must still reject.
	for _, k := range []string{"display_switch", "if", "when", "show_if", "$merge", "$after"} {
		in := `{"options":{"` + k + `":1}}`
		var f FieldSpec
		if err := json.Unmarshal([]byte(in), &f); err == nil {
			t.Fatalf("forbidden key %q accepted under options", k)
		}
	}
}

func TestForbiddenMetaKeysRejectedUnderTypedSlots(t *testing.T) {
	cases := []string{
		`{"validate":{"if":true}}`,
		`{"design":{"display_target":"x"}}`,
		`{"behavior":{"when":"y"}}`,
		`{"multiple":{"$remove":1}}`,
		`{"lang":{"show_if":1}}`,
		`{"items":{"$before":1}}`,
	}
	for _, in := range cases {
		var f FieldSpec
		if err := json.Unmarshal([]byte(in), &f); err == nil {
			t.Fatalf("forbidden key accepted: %s", in)
		}
	}
}

func TestXCommentKeyRejected(t *testing.T) {
	for _, in := range []string{`{"xclass":"c"}`, `{"xstyle":"s"}`, `{"options":{"xfoo":1}}`} {
		var f FieldSpec
		if err := json.Unmarshal([]byte(in), &f); err == nil {
			t.Fatalf("x-comment key accepted: %s", in)
		}
	}
}

func TestNonCanonicalKeysNotRecognized(t *testing.T) {
	// Non-canonical names never map onto a canonical field. multiple is a closed
	// bucket, so multiple_max under it is rejected as an unknown key.
	in := `{"multiple":{"multiple_max":9}}`
	var f FieldSpec
	err := json.Unmarshal([]byte(in), &f)
	if err == nil || err.Error() != `model: unknown key "multiple_max" in multiple` {
		t.Fatalf("multiple_max not rejected: %v", err)
	}
}

func TestClosedBucketsRejectUnknownKeys(t *testing.T) {
	cases := map[string]string{
		`{"design":{"class":"a","label_class":"b","other":1}}`:   `model: unknown key "label_class" in design`,
		`{"multiple":{"z":1,"5":1}}`:                             `model: unknown key "5" in multiple`,
		`{"behavior":{"onx":1,"01":1,"4294967294":1}}`:           `model: unknown key "4294967294" in behavior`,
		`{"lang":{"x":1,"4294967295":1}}`:                        `model: unknown key "x" in lang`,
		`{"design":{"label":{"class":"a","text":"b"}}}`:          `model: unknown key "text" in design.label`,
		`{"design":{"wrapper":{"id":"w"},"prepend":{"id":"p"}}}`: `model: unknown key "id" in design.wrapper`,
		`{"design":{"group":{"style":"s","id":"g"}}}`:            `model: unknown key "id" in design.group`,
		`{"design":{"prepend":{"text":"p"}}}`:                    `model: unknown key "text" in design.prepend`,
		`{"behavior":{"onchange":"f()","onsubmit":"g()"}}`:       `model: unknown key "onsubmit" in behavior`,
		`{"multiple":{"min":1,"foo":1}}`:                         `model: unknown key "foo" in multiple`,
		`{"lang":{"mode":"append","langs":["ko"]}}`:              `model: unknown key "langs" in lang`,
		`{"design":{"if":true,"foo":1}}`:                         `model: forbidden meta key "if" in design`,
		`{"multiple":{"foo":1,"$remove":1}}`:                     `model: forbidden meta key "$remove" in multiple`,
	}
	for in, want := range cases {
		var f FieldSpec
		if err := json.Unmarshal([]byte(in), &f); err == nil || err.Error() != want {
			t.Fatalf("%s: want %s, got %v", in, want, err)
		}
	}
	var n DesignNode
	if err := json.Unmarshal([]byte(`{"class":"c","text":"t"}`), &n); err == nil || err.Error() != `model: unknown key "text" in design node` {
		t.Fatalf("design node accepted an unknown key: %v", err)
	}
}

// Declared attributes (docs/spec/schema.md, Declared attributes): design.attributes and
// design.wrapper.attributes keep their order; other nodes and non-string values are rejected.
func TestDesignDeclaredAttributes(t *testing.T) {
	roundTrip(t, `{"design":{"class":"c","attributes":{"data-setting":"theme","aria-describedby":"help"},"wrapper":{"class":"row","attributes":{"data-section":"look"}}}}`)
	cases := map[string]string{
		`{"design":{"label":{"attributes":{"data-x":"1"}}}}`: `model: unknown key "attributes" in design.label`,
		`{"design":{"attributes":{"data-x":1}}}`:             `model: attribute "data-x" is not a string`,
		`{"design":{"wrapper":{"attributes":"data-x"}}}`:     `model: attributes must be an object`,
	}
	for in, want := range cases {
		var f FieldSpec
		if err := json.Unmarshal([]byte(in), &f); err == nil || !strings.HasPrefix(err.Error(), want) {
			t.Fatalf("%s: want %s, got %v", in, want, err)
		}
	}
}

func TestValidateExtraStructuralRoundTrip(t *testing.T) {
	in := `{"validate":{"required":true,"minlength":3,"in":{"a":"A"}}}`
	var f FieldSpec
	if err := json.Unmarshal([]byte(in), &f); err != nil {
		t.Fatal(err)
	}
	if f.Validate.Extra["minlength"] != float64(3) {
		t.Fatalf("validate Extra not captured: %#v", f.Validate.Extra)
	}
	out, err := json.Marshal(&f)
	if err != nil {
		t.Fatal(err)
	}
	var got FieldSpec
	if err := json.Unmarshal(out, &got); err != nil {
		t.Fatal(err)
	}
	if got.Validate.Required != true || got.Validate.Extra["minlength"] != float64(3) || got.Validate.Extra["in"] == nil {
		t.Fatalf("validate structural round-trip lost data: %s", out)
	}
	var forbidden FieldSpec
	if err := json.Unmarshal([]byte(`{"validate":{"required":1,"when":1}}`), &forbidden); err == nil {
		t.Fatal("forbidden key accepted under validate")
	}
}

func TestNestedForbiddenKeyInPropertiesChild(t *testing.T) {
	in := `{"properties":{"child":{"if":true}}}`
	var f FieldSpec
	if err := json.Unmarshal([]byte(in), &f); err == nil {
		t.Fatalf("forbidden key in nested child accepted")
	}
}

func TestRuleKeysAreRegisteredRules(t *testing.T) {
	cases := map[string]string{
		`{"validate":{"required":true,"custom":1}}`:   `model: unknown key "custom" in validate`,
		`{"validate":{"equalto":".a"}}`:               `model: unknown key "equalto" in validate`,
		`{"messages":{"required":"r","requird":"x"}}`: `model: unknown key "requird" in messages`,
	}
	for in, want := range cases {
		var f FieldSpec
		if err := json.Unmarshal([]byte(in), &f); err == nil || err.Error() != want {
			t.Fatalf("%s: want %s, got %v", in, want, err)
		}
	}
	var f FieldSpec
	if err := json.Unmarshal([]byte(`{"messages":{"required":1}}`), &f); err == nil {
		t.Fatal("a message that is not a string was accepted")
	}
	roundTrip(t, `{"type":"number","messages":{"number":"n","required":"r"}}`)
	roundTrip(t, `{"type":"button","content":{"ko":"저장","en":"Save"}}`)
}

func TestTopLevelKeysAreTheSchemaFieldKeys(t *testing.T) {
	data, err := os.ReadFile("../../../../../contracts/schema/crudui.schema.json")
	if err != nil {
		t.Fatal(err)
	}
	var schema struct {
		Definitions struct {
			Field struct {
				Properties json.RawMessage `json:"properties"`
			} `json:"Field"`
		} `json:"definitions"`
	}
	if err := json.Unmarshal(data, &schema); err != nil {
		t.Fatal(err)
	}
	keys, _, err := objectMembers(schema.Definitions.Field.Properties)
	if err != nil {
		t.Fatal(err)
	}
	var fieldKeys []string
	model := reflect.TypeOf(FieldSpec{})
	for i := 0; i < model.NumField(); i++ {
		fieldKeys = append(fieldKeys, strings.Split(model.Field(i).Tag.Get("json"), ",")[0])
	}
	want := slices.DeleteFunc(slices.Clone(keys), func(key string) bool { return key == "$ref" || key == "$patch" })
	if !slices.Equal(fieldKeys, want) {
		t.Fatalf("model keys %v, schema keys %v", fieldKeys, want)
	}
}

// Layout (docs/spec/schema.md, Layout): a group declares design.layout, which the design slot keeps.
func TestDesignLayout(t *testing.T) {
	roundTrip(t, `{"type":"group","design":{"layout":"inline","wrapper":{"class":"section"}}}`)
}

// TestFormDataLimitsRoundTrip preserves optional members in the Go model.
func TestFormDataLimitsRoundTrip(t *testing.T) {
	for _, input := range []string{
		`{"type":"group","dataLimits":{}}`,
		`{"type":"group","dataLimits":{"depth":512}}`,
		`{"type":"group","dataLimits":{"values":1000000}}`,
		`{"type":"group","dataLimits":{"depth":512,"values":1000000}}`,
	} {
		roundTrip(t, input)
	}
}
