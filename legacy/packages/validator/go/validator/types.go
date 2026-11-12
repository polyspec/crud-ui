// Package model is the canonical (SPEC-mechanized, single-truth) Go model of the
// crudui field.
//
// The model encodes SPEC §3 exactly:
//
//   - Four role slots (validate / design / behavior / options). Each is
//     polymorphic across three shapes: false | {} | true. false cancels a
//     composed inheritance; {} carries the slot's sub-keys; true is the bare
//     opt-in. Every shape survives a round trip (custom UnmarshalJSON).
//   - Dependency isolation. A dependent key lives next to its target, never at
//     top level: scalar-type dependents go in options; multiple / lang / items
//     dependents go under that key. The structure keys multiple / lang are
//     themselves polymorphic false | {} | true.
//   - design node map. design addresses appearance per DOM node by key
//     (show / class / style / attributes / layout / label.{class,style} /
//     wrapper.{class,style,attributes} / group.{class,style} /
//     prepend.{class,style}) — R8: which node a style targets is visible in the
//     key, not inferred.
//   - condition maps. A declaration-ordered map whose default key is the
//     literal true (R4 — no convention sigils such as _). Keys are evaluated in
//     declaration order; the first truthy key wins; order is preserved on a
//     round trip.
//   - composition. $ref (base inheritance) expands first, then $patch
//     (add / remove / replace).
//
// Only canonical model keys are recognized. Other spellings (multiple_max,
// lang:append, sortable*, add_buttons, …) and magic tokens (`*`, `:`) are NOT
// valid keys here; they have no field on any struct and are rejected (R2 / R4).
//
// Buckets are closed or open, as in the JSON schema. The closed buckets design,
// design.{label,wrapper,group,prepend}, behavior, multiple and lang reject any
// key they do not model on Unmarshal, and validate and messages accept the
// registered rule names only (RuleNames). The open bucket options
// (Options.Extra) keeps unknown keys.
//
// Forbidden meta keys are rejected GLOBALLY, not only at top level: every open
// bucket guards against them on Unmarshal, one level under the bucket too. A
// schema layer expresses the same with propertyNames:{not:{enum:[…]}} rather
// than additionalProperties:true, so extension is allowed but forbidden keys are
// blocked everywhere.
//
// x{key} comment keys (x-prefixed) are rejected here. The premise is that a
// meta-schema x-strips them first, then validates the canonical spec; the strip
// is the documented reason a raw x{key} never reaches this model.
package validator

import (
	"bytes"
	"encoding/json"
	"fmt"
	"slices"
	"strings"

	"github.com/polyspec/crudui/packages/validator/go/validator/compose"
)

// FieldSpec is the canonical model field. Every member maps to one top-level SPEC
// key. The four role slots (Validate / Design / Behavior / Options) and the
// polymorphic structure keys (Multiple / Lang) are pointers so the absent /
// false / {} / true shapes all survive a round trip.
//
// A schema layer over this type rejects every key not listed below and every
// ForbiddenMetaKey; the absent condition-only meta keys must never return.
type FieldSpec struct {
	// Type is structure / identity — the field's widget type. Its target is a
	// scalar, so type-dependent detail is isolated in the Options slot.
	Type string `json:"type,omitempty"`

	// Name is structure / identity — the field name (identifier). Explicit and
	// semantic (R4).
	Name string `json:"name,omitempty"`

	// Default is structure / identity — the default value the evaluator reads
	// when a path is unresolved (expressions.md §5 Path).
	Default any `json:"default,omitempty"`

	// Properties is structure / identity — the child-field map (group / object),
	// in declaration order. It is the $ref / $patch composition entry point.
	Properties *PropertyMap `json:"properties,omitempty"`

	// Items is structure / identity — the choice source: a static array, a
	// static value→label map, or a dynamic source. The dynamic
	// source (type: search) is a model (name string OR nested
	// {table,relations,keys} query) + a sibling api_server (runtime HTTP fn
	// reference) + a placeholder static items, all isolated under it and
	// preserved verbatim. Runtime resolution is out of scope (SPEC §6 R1).
	Items *Items `json:"items,omitempty"`

	// Multiple is structure / identity — repeated rows (true = on). Polymorphic
	// false | {} | true; repetition dependents are isolated under it. Row
	// identity (G4) is NOT a multiple field — at runtime it is a hidden server PK
	// carried in the submitted data, not a build-time spec field (no id key).
	Multiple *Multiple `json:"multiple,omitempty"`

	// Lang is structure / identity — the input-multilingual dimension (the field
	// value is per language, G3). Same structural axis as Multiple. Polymorphic
	// false | {} | true; lang dependents are isolated under it.
	Lang *Lang `json:"lang,omitempty"`

	// Label is content — the field label. May be a language map {ko,en} (G3
	// axis 1). The label sits at top level, next to the field it modifies.
	Label *Content `json:"label,omitempty"`

	// Description is content — the description (may be a language map, G3).
	Description *Content `json:"description,omitempty"`

	// Placeholder is content — the placeholder text.
	Placeholder *Content `json:"placeholder,omitempty"`

	// Prepend is content — text before the input (distinct from the
	// design.prepend node appearance: this is the content text itself).
	Prepend *Content `json:"prepend,omitempty"`

	// Append is content — text after the input.
	Append *Content `json:"append,omitempty"`

	// Help is content — help text (may be a language map, G3).
	Help *Content `json:"help,omitempty"`

	// Content is content — the control text of a button or action field (may
	// be a language map, G3).
	Content *Content `json:"content,omitempty"`

	// Validate is the validation role slot (common, every field).
	Validate *ValidateSlot `json:"validate,omitempty"`

	// Messages are error message overrides keyed by registered rule name.
	Messages *Messages `json:"messages,omitempty"`

	// Design is the appearance role slot — display condition plus a per-node
	// appearance map.
	Design *DesignSlot `json:"design,omitempty"`

	// Behavior is the behavior role slot — opaque scripts that never pass
	// through the expression engine.
	Behavior *BehaviorSlot `json:"behavior,omitempty"`

	// Options is the type-dependent role slot — the type defines and validates
	// it; the core does not participate.
	Options *OptionsSlot `json:"options,omitempty"`

	// Buttons are the form buttons rendered in the form footer. Honored on the
	// form root only.
	Buttons []FormButton `json:"buttons,omitempty"`

	// Action is the submission target kept unchanged in the template. Honored on the
	// form root only.
	Action *FormAction `json:"action,omitempty"`

	// DataLimits bounds submitted data on the form root (CUSC-087).
	DataLimits *FormDataLimits `json:"dataLimits,omitempty"`
}

// FormDataLimits declares the submission depth and value limits (CUSC-087).
// A missing member uses the validation default (CUVR-083).
type FormDataLimits struct {
	// Depth is the maximum number of nested container levels.
	Depth *int `json:"depth,omitempty"`
	// Values is the maximum number of submitted value nodes.
	Values *int `json:"values,omitempty"`
}

// FormButton is one form button. A button or link needs text; a link needs href.
type FormButton struct {
	// Type is submit, reset, button or link.
	Type string `json:"type"`
	// Text is the button text, optionally a language map.
	Text *Content `json:"text,omitempty"`
	// Name is the submitted name.
	Name string `json:"name,omitempty"`
	// Value is the submitted value.
	Value string `json:"value,omitempty"`
	// Href is the link target.
	Href string `json:"href,omitempty"`
	// Design is the button appearance.
	Design *DesignSlot `json:"design,omitempty"`
	// Behavior holds opaque behavior scripts.
	Behavior *BehaviorSlot `json:"behavior,omitempty"`
}

// FormAction is the submission target of the form, kept unchanged in the template.
type FormAction struct {
	// Method is the HTTP method.
	Method string `json:"method,omitempty"`
	// URL is the submission URL.
	URL string `json:"url,omitempty"`
	// Enctype is the submission encoding.
	Enctype string `json:"enctype,omitempty"`
}

// fieldSpecAlias avoids UnmarshalJSON recursion and lets the decoder reject any
// unknown / forbidden top-level key.
type fieldSpecAlias FieldSpec

// UnmarshalJSON decodes a FieldSpec and rejects any forbidden meta key present
// at the top level (the schema's additionalProperties:false / propertyNames
// guard, mechanized).
func (f *FieldSpec) UnmarshalJSON(data []byte) error {
	if err := rejectForbiddenKeys(data, "field"); err != nil {
		return err
	}
	var a fieldSpecAlias
	if err := json.Unmarshal(data, &a); err != nil {
		return err
	}
	*f = FieldSpec(a)
	return nil
}

// PropertyMap is a declaration-ordered child-field map (group / object). Order
// is preserved on a round trip because emission and composition depend on it. It
// is the $ref / $patch composition entry point.
type PropertyMap struct {
	// Keys holds property names in declaration order.
	Keys []string
	// Values maps each property name to its FieldSpec.
	Values map[string]*FieldSpec
}

// MarshalJSON emits PropertyMap as a JSON object in declaration order.
func (p *PropertyMap) MarshalJSON() ([]byte, error) {
	if p == nil {
		return []byte("null"), nil
	}
	return marshalOrdered(p.Keys, p.Values)
}

// UnmarshalJSON decodes a property object while preserving declaration order via
// a token walk. Each child value is decoded into a FieldSpec, so forbidden keys
// nested in a child are rejected by the child's own UnmarshalJSON.
func (p *PropertyMap) UnmarshalJSON(data []byte) error {
	keys, values, err := decodeOrdered[*FieldSpec](data, "properties must be an object")
	if err != nil {
		return err
	}
	p.Keys = keys
	p.Values = values
	return nil
}

// Content is a content value that is a plain string, a language map (G3 content
// translation, e.g. {ko, en}), or null (empty content — identical to absent, no
// render/validate effect, SPEC §2 G3). The language map preserves declaration
// order on a round trip (LangKeys), since emission order is observable; a
// per-language slot may itself be null (empty label for that language), kept as a
// nil *string so the empty slot round-trips as null.
type Content struct {
	// Text is the monolingual value.
	Text *string
	// LangKeys holds language codes in declaration order.
	LangKeys []string
	// Lang is the per-language value, language code → text; a nil entry is a
	// null (empty) label slot for that language (G3 — no effect).
	Lang map[string]*string
	// Null is the explicit null-content form: the whole content is empty/absent.
	// It round-trips as the JSON literal null (SPEC §2 G3).
	Null bool
}

// MarshalJSON emits a Content as null, a string, or an ordered language object
// (per-language null slots emit as JSON null).
func (c *Content) MarshalJSON() ([]byte, error) {
	if c == nil {
		return []byte("null"), nil
	}
	if c.Null {
		return []byte("null"), nil
	}
	if c.Lang != nil {
		return marshalOrdered(c.LangKeys, c.Lang) // nil *string → null (G3 empty slot)
	}
	if c.Text != nil {
		return json.Marshal(*c.Text)
	}
	return []byte("null"), nil
}

// UnmarshalJSON reads a Content from a JSON string, language object, or null,
// preserving language-key order via a token walk. A per-language null value is
// kept as a nil *string (G3 empty slot — no effect); a bare null is the
// null-content form.
func (c *Content) UnmarshalJSON(data []byte) error {
	if string(bytes.TrimSpace(data)) == "null" {
		c.Text = nil
		c.Lang = nil
		c.LangKeys = nil
		c.Null = true
		return nil
	}
	var s string
	if err := json.Unmarshal(data, &s); err == nil {
		c.Text = &s
		c.Lang = nil
		c.LangKeys = nil
		c.Null = false
		return nil
	}
	keys, values, err := decodeOrdered[*string](data, "content must be a string, a language object, or null")
	if err != nil {
		return err
	}
	c.Text = nil
	c.Null = false
	c.LangKeys = keys
	c.Lang = values // a nil entry is a JSON null slot (G3 empty slot)
	return nil
}

// ConditionMap is the declaration-ordered condition map (SPEC condition_map).
// Keys are evaluated in declaration order; the first truthy key's value is
// returned. If none match, the value under the literal "true" key (if present)
// is returned, else null. The default key is always the literal true
// (ConditionDefaultKey) — R4 forbids convention sigils such as "_". Each key is
// an expressions.md §2 expression; the map is a thin wrapper that re-invokes
// the engine, not a separate parser. A single ternary "...?...:..." is the
// shorthand (same semantics). Evaluated value type — boolean | string | number |
// null — is decided by the call site, not the map. Order is preserved on a round
// trip.
type ConditionMap struct {
	// Keys holds condition expressions in declaration order; the last is
	// typically ConditionDefaultKey.
	Keys []string
	// Values maps each condition expression to its result value.
	Values map[string]any
}

// ConditionDefaultKey is the only allowed default key of a condition map: the
// literal true. Convention sigils (e.g. "_") are an R4 violation.
const ConditionDefaultKey = "true"

// MarshalJSON emits ConditionMap as a JSON object in declaration order.
func (c *ConditionMap) MarshalJSON() ([]byte, error) {
	if c == nil {
		return []byte("null"), nil
	}
	return marshalOrdered(c.Keys, c.Values)
}

// UnmarshalJSON decodes a condition map preserving declaration order.
func (c *ConditionMap) UnmarshalJSON(data []byte) error {
	keys, values, err := decodeOrdered[any](data, "condition map must be an object")
	if err != nil {
		return err
	}
	c.Keys = keys
	c.Values = values
	return nil
}

// ValidateSlot is the validate role slot. Polymorphic: Cancel = the false shape
// (cancels composed inheritance), Bare = the true shape, otherwise the body
// fields carry the {} shape.
//
// Each sub-key value may be an expression or a condition map, so conditional
// validation is expressed without a separate key (e.g. required: '.subscribe',
// email: true). validate accepts the registered rule names only (RuleNames):
// Extra keeps every further registered rule, and any other key is rejected on
// Unmarshal.
type ValidateSlot struct {
	// Cancel is the false shape: cancels a composed-in validate slot.
	Cancel bool `json:"-"`
	// Bare is the true shape: bare opt-in with no body.
	Bare bool `json:"-"`

	// Required is the required rule (bool, expression, or condition map).
	Required any `json:"required,omitempty"`
	// Email is the email-format rule.
	Email any `json:"email,omitempty"`
	// Match is the cross-field match rule.
	Match any `json:"match,omitempty"`

	// Extra holds the further registered rules not modeled above.
	Extra map[string]any `json:"-"`
}

// RuleNames are the registered rule names, the only keys of validate and
// messages. The validate package's rule registry has exactly these rules.
var RuleNames = []string{
	"required", "email", "minlength", "maxlength", "min", "max", "match", "pattern",
	"unique", "in", "range", "rangelength", "number", "digits", "equalTo", "containedIn", "typeFrom", "minFrom", "maxFrom", "notEqual",
	"date", "dateISO", "enddate", "url", "accept", "mincount", "maxcount", "step",
	"conditionTree",
	"reference",
}

// Messages are error message overrides keyed by registered rule name, in
// declaration order. Every message is a string.
type Messages struct {
	// Keys holds rule names in declaration order.
	Keys []string
	// Values maps each rule name to its message.
	Values map[string]string
}

// MarshalJSON emits Messages as a JSON object in declaration order.
func (m *Messages) MarshalJSON() ([]byte, error) {
	return marshalOrdered(m.Keys, m.Values)
}

// UnmarshalJSON reads Messages and rejects a key that is not a registered rule
// name and a message that is not a string.
func (m *Messages) UnmarshalJSON(data []byte) error {
	if err := rejectUnknownKeys(data, "messages", RuleNames); err != nil {
		return err
	}
	keys, values, err := objectMembers(data)
	if err != nil {
		return err
	}
	m.Keys = keys
	m.Values = make(map[string]string, len(keys))
	for i, key := range keys {
		var message string
		if err := json.Unmarshal(values[i], &message); err != nil {
			return fmt.Errorf("model: message %q is not a string: %w", key, err)
		}
		m.Values[key] = message
	}
	return nil
}

// validateNamedKeys are the modeled validate sub-keys; every other registered
// rule in the object goes into Extra on Unmarshal.
var validateNamedKeys = map[string]bool{
	"required": true,
	"email":    true,
	"match":    true,
}

// shape reports the false shape (Cancel) and the true shape (Bare) of the slot.
func (s *ValidateSlot) shape() (cancel, bare bool) {
	return s.Cancel, s.Bare
}

// MarshalJSON emits a ValidateSlot as false, true, or the body object.
func (s *ValidateSlot) MarshalJSON() ([]byte, error) {
	if literal, ok := shapeLiteral(s); ok {
		return literal, nil
	}
	type alias ValidateSlot
	body, err := json.Marshal((*alias)(s))
	if err != nil {
		return nil, err
	}
	return mergeExtra(body, s.Extra)
}

// UnmarshalJSON reads a ValidateSlot in its polymorphic shape.
func (s *ValidateSlot) UnmarshalJSON(data []byte) error {
	if b, ok := scalarBool(data); ok {
		s.Cancel = !b
		s.Bare = b
		return nil
	}
	if err := rejectForbiddenKeys(data, "validate"); err != nil {
		return err
	}
	if err := rejectUnknownKeys(data, "validate", RuleNames); err != nil {
		return err
	}
	type alias ValidateSlot
	var a alias
	if err := json.Unmarshal(data, &a); err != nil {
		return err
	}
	*s = ValidateSlot(a)
	extra, err := extraKeys(data, validateNamedKeys)
	if err != nil {
		return err
	}
	s.Extra = extra
	return nil
}

// DesignSlot is the design role slot — appearance = display condition (Show) +
// a per-DOM-node appearance map. R8: the targeted node is visible in the key;
// per-node classes are declared here, never as element_class / label_class /
// group_class / input_class / wrapper_class / prepend_class siblings.
//
// Polymorphic: Cancel = the false shape, Bare = the true shape, otherwise the
// body carries the {} shape. design is a closed bucket: Unmarshal rejects any
// key outside show / class / style / attributes / layout / label / wrapper /
// group / prepend, and any node key outside class / style, and attributes on the
// wrapper (DesignNodeMap).
type DesignSlot struct {
	// Cancel is the false shape: cancels a composed-in design slot.
	Cancel bool `json:"-"`
	// Bare is the true shape: bare opt-in with no body.
	Bare bool `json:"-"`

	// Show is the display condition (expression or condition map), not a node.
	// A false result hides the field; validation of a hidden field is skipped.
	Show any `json:"show,omitempty"`
	// Class is the appearance class for the field's own (main / input) node.
	Class any `json:"class,omitempty"`
	// Style is the inline appearance for the field's own node.
	Style any `json:"style,omitempty"`
	// Attributes are the attributes a form field declares for its control.
	Attributes *DeclaredAttributes `json:"attributes,omitempty"`
	// Layout is the layout a group declares for its fields: stacked, inline or line.
	Layout string `json:"layout,omitempty"`
	// Label is the appearance map for the label node.
	Label *DesignNode `json:"label,omitempty"`
	// Wrapper is the appearance map and the declared attributes of the wrapper node.
	Wrapper *WrapperNode `json:"wrapper,omitempty"`
	// Group is the appearance map for the group node.
	Group *DesignNode `json:"group,omitempty"`
	// Prepend is the appearance map for the prepend node.
	Prepend *DesignNode `json:"prepend,omitempty"`
}

// shape reports the false shape (Cancel) and the true shape (Bare) of the slot.
func (s *DesignSlot) shape() (cancel, bare bool) {
	return s.Cancel, s.Bare
}

// MarshalJSON emits a DesignSlot as false, true, or the body object.
func (s *DesignSlot) MarshalJSON() ([]byte, error) {
	if literal, ok := shapeLiteral(s); ok {
		return literal, nil
	}
	type alias DesignSlot
	return json.Marshal((*alias)(s))
}

// UnmarshalJSON reads a DesignSlot in its polymorphic shape.
func (s *DesignSlot) UnmarshalJSON(data []byte) error {
	if b, ok := scalarBool(data); ok {
		s.Cancel = !b
		s.Bare = b
		return nil
	}
	if err := rejectForbiddenKeys(data, "design"); err != nil {
		return err
	}
	if err := rejectUnknownKeys(data, "design", designKeys); err != nil {
		return err
	}
	keys, values, err := objectMembers(data)
	if err != nil {
		return err
	}
	for i, key := range keys {
		allowed := designNodeKeys
		if key == "wrapper" {
			allowed = wrapperNodeKeys
		}
		if key == "label" || key == "wrapper" || key == "group" || key == "prepend" {
			if err := rejectUnknownKeys(values[i], "design."+key, allowed); err != nil {
				return err
			}
		}
	}
	type alias DesignSlot
	var a alias
	if err := json.Unmarshal(data, &a); err != nil {
		return err
	}
	*s = DesignSlot(a)
	return nil
}

// DesignNode is the appearance of one named DOM node within the design node map:
// its class and inline style. Either may be an expression or condition map. It is
// a closed bucket: Unmarshal rejects any key beyond class / style.
type DesignNode struct {
	// Class is the node's appearance class.
	Class any `json:"class,omitempty"`
	// Style is the node's inline appearance.
	Style any `json:"style,omitempty"`
}

// designKeys are the keys a design object allows.
var designKeys = []string{"show", "class", "style", "attributes", "layout", "label", "wrapper", "group", "prepend"}

// designNodeKeys are the keys a design node allows.
var designNodeKeys = []string{"class", "style"}

// wrapperNodeKeys are the keys the wrapper design node allows.
var wrapperNodeKeys = []string{"class", "style", "attributes"}

// WrapperNode is the appearance of the wrapper node (the node root) and the
// attributes a form field declares for it. It is a closed bucket: Unmarshal
// rejects any key beyond class / style / attributes.
type WrapperNode struct {
	// Class is the node's appearance class.
	Class any `json:"class,omitempty"`
	// Style is the node's inline appearance.
	Style any `json:"style,omitempty"`
	// Attributes are the attributes declared for the node root.
	Attributes *DeclaredAttributes `json:"attributes,omitempty"`
}

// UnmarshalJSON reads a WrapperNode and rejects any key beyond class / style / attributes.
func (n *WrapperNode) UnmarshalJSON(data []byte) error {
	if err := rejectUnknownKeys(data, "design.wrapper", wrapperNodeKeys); err != nil {
		return err
	}
	type alias WrapperNode
	var a alias
	if err := json.Unmarshal(data, &a); err != nil {
		return err
	}
	*n = WrapperNode(a)
	return nil
}

// DeclaredAttributes are the attributes a form field declares for an element,
// in declaration order. Every value is a string; compilation checks the names.
type DeclaredAttributes struct {
	// Keys holds the attribute names in declaration order.
	Keys []string
	// Values maps each attribute name to its value.
	Values map[string]string
}

// MarshalJSON emits DeclaredAttributes as a JSON object in declaration order.
func (a *DeclaredAttributes) MarshalJSON() ([]byte, error) {
	return marshalOrdered(a.Keys, a.Values)
}

// UnmarshalJSON reads DeclaredAttributes and rejects a value that is not an
// object and a member value that is not a string.
func (a *DeclaredAttributes) UnmarshalJSON(data []byte) error {
	if trimmed := bytes.TrimSpace(data); len(trimmed) == 0 || trimmed[0] != '{' {
		return fmt.Errorf("model: attributes must be an object")
	}
	keys, values, err := objectMembers(data)
	if err != nil {
		return err
	}
	a.Keys = keys
	a.Values = make(map[string]string, len(keys))
	for i, key := range keys {
		var value string
		if err := json.Unmarshal(values[i], &value); err != nil {
			return fmt.Errorf("model: attribute %q is not a string: %w", key, err)
		}
		a.Values[key] = value
	}
	return nil
}

// UnmarshalJSON reads a DesignNode and rejects any key beyond class / style.
func (n *DesignNode) UnmarshalJSON(data []byte) error {
	if err := rejectUnknownKeys(data, "design node", designNodeKeys); err != nil {
		return err
	}
	type alias DesignNode
	var a alias
	if err := json.Unmarshal(data, &a); err != nil {
		return err
	}
	*n = DesignNode(a)
	return nil
}

// DesignNodeMap is the closed set of design node-map address keys (SPEC
// design_node_map). design may address only these node paths.
var DesignNodeMap = []string{
	"show",
	"class",
	"style",
	"attributes",
	"label.class",
	"label.style",
	"wrapper.class",
	"wrapper.style",
	"wrapper.attributes",
	"group.class",
	"group.style",
	"prepend.class",
	"prepend.style",
}

// BehaviorSlot is the behavior role slot — common across all types. Scripts are
// passed through opaquely to client JS and never enter the expression engine
// (G1 / §4). false (Cancel) cancels a composed-in behavior. A behavior's label
// is behavior.{action}.label, adjacent to the action.
//
// Polymorphic: Cancel = the false shape, Bare = the true shape, otherwise the
// body carries the {} shape. behavior is a closed bucket: Unmarshal rejects any
// sub-key outside onchange / onclick / onload.
type BehaviorSlot struct {
	// Cancel is the false shape: cancels a composed-in behavior slot.
	Cancel bool `json:"-"`
	// Bare is the true shape: bare opt-in with no body.
	Bare bool `json:"-"`

	// Onchange is the opaque change-handler script.
	Onchange any `json:"onchange,omitempty"`
	// Onclick is the opaque click-handler script.
	Onclick any `json:"onclick,omitempty"`
	// Onload is the opaque load-handler script.
	Onload any `json:"onload,omitempty"`
}

// shape reports the false shape (Cancel) and the true shape (Bare) of the slot.
func (s *BehaviorSlot) shape() (cancel, bare bool) {
	return s.Cancel, s.Bare
}

// MarshalJSON emits a BehaviorSlot as false, true, or the body object.
func (s *BehaviorSlot) MarshalJSON() ([]byte, error) {
	if literal, ok := shapeLiteral(s); ok {
		return literal, nil
	}
	type alias BehaviorSlot
	return json.Marshal((*alias)(s))
}

// UnmarshalJSON reads a BehaviorSlot in its polymorphic shape.
func (s *BehaviorSlot) UnmarshalJSON(data []byte) error {
	if b, ok := scalarBool(data); ok {
		s.Cancel = !b
		s.Bare = b
		return nil
	}
	if err := rejectForbiddenKeys(data, "behavior"); err != nil {
		return err
	}
	if err := rejectUnknownKeys(data, "behavior", []string{"onchange", "onclick", "onload"}); err != nil {
		return err
	}
	type alias BehaviorSlot
	var a alias
	if err := json.Unmarshal(data, &a); err != nil {
		return err
	}
	*s = BehaviorSlot(a)
	return nil
}

// OptionsSlot is the type-dependent role slot and the dependency-isolation
// bucket for the scalar Type target: the type defines and validates these
// settings, the core stays uninvolved, and a new widget needs no core change.
// Container-type chrome and type-dependent scripts / callbacks live here too.
//
// Polymorphic: Cancel = the false shape, Bare = the true shape, otherwise the
// body carries the {} shape. The named fields below are the documented scalar
// dependents; Extra holds any further type-owned keys the core does not model.
// Extra is an open bucket but still rejects every ForbiddenMetaKey on Unmarshal
// — extension is allowed, forbidden keys are blocked one level under the bucket.
type OptionsSlot struct {
	// Cancel is the false shape: cancels a composed-in options slot.
	Cancel bool `json:"-"`
	// Bare is the true shape: bare opt-in with no body.
	Bare bool `json:"-"`

	// KeywordMinLength is the minimum keyword length before lookup fires.
	KeywordMinLength any `json:"keyword_min_length,omitempty"`
	// MarkerDraggable toggles a draggable map marker.
	MarkerDraggable any `json:"marker_draggable,omitempty"`
	// Zoom is the initial map zoom level.
	Zoom any `json:"zoom,omitempty"`
	// GeometryType is the map geometry kind.
	GeometryType any `json:"geometry_type,omitempty"`
	// MaxTags caps the number of tags.
	MaxTags any `json:"max_tags,omitempty"`
	// CheckboxLabel is the inline checkbox label.
	CheckboxLabel any `json:"checkbox_label,omitempty"`
	// OnLabel is the toggle's on-state label.
	OnLabel any `json:"on_label,omitempty"`
	// Collapse toggles a collapsible container.
	Collapse any `json:"collapse,omitempty"`
	// Expend toggles an expandable container.
	Expend any `json:"expend,omitempty"`
	// ViewTotal toggles a total view.
	ViewTotal any `json:"view_total,omitempty"`
	// Stepper toggles stepper controls.
	Stepper any `json:"stepper,omitempty"`
	// BlankMessage is the empty-state message.
	BlankMessage any `json:"blank_message,omitempty"`
	// Callback is the type-dependent callback reference.
	Callback any `json:"callback,omitempty"`
	// Event is the type-dependent event reference.
	Event any `json:"event,omitempty"`

	// Extra holds any further type-owned option keys not modeled above. The
	// core does not interpret them; only the type does. Forbidden meta keys are
	// rejected here too.
	Extra map[string]any `json:"-"`
}

// optionsNamedKeys are the modeled Options sub-keys; everything else in the
// object goes into Extra on Unmarshal.
var optionsNamedKeys = map[string]bool{
	"keyword_min_length": true,
	"marker_draggable":   true,
	"zoom":               true,
	"geometry_type":      true,
	"max_tags":           true,
	"checkbox_label":     true,
	"on_label":           true,
	"collapse":           true,
	"expend":             true,
	"view_total":         true,
	"stepper":            true,
	"blank_message":      true,
	"callback":           true,
	"event":              true,
}

// shape reports the false shape (Cancel) and the true shape (Bare) of the slot.
func (s *OptionsSlot) shape() (cancel, bare bool) {
	return s.Cancel, s.Bare
}

// MarshalJSON emits an OptionsSlot as false, true, or the body object, inlining
// Extra keys after the named fields.
func (s *OptionsSlot) MarshalJSON() ([]byte, error) {
	if literal, ok := shapeLiteral(s); ok {
		return literal, nil
	}
	type alias OptionsSlot
	body, err := json.Marshal((*alias)(s))
	if err != nil {
		return nil, err
	}
	return mergeExtra(body, s.Extra)
}

// mergeExtra inlines an open bucket's Extra keys into its marshaled named fields.
func mergeExtra(body []byte, extra map[string]any) ([]byte, error) {
	if len(extra) == 0 {
		return body, nil
	}
	var merged map[string]json.RawMessage
	if err := json.Unmarshal(body, &merged); err != nil {
		return nil, err
	}
	for k, v := range extra {
		rv, err := json.Marshal(v)
		if err != nil {
			return nil, err
		}
		merged[k] = rv
	}
	return json.Marshal(merged)
}

// extraKeys decodes every key of an open bucket object that named does not model.
func extraKeys(data []byte, named map[string]bool) (map[string]any, error) {
	var raw map[string]json.RawMessage
	if err := json.Unmarshal(data, &raw); err != nil {
		return nil, err
	}
	var extra map[string]any
	for k, v := range raw {
		if named[k] {
			continue
		}
		if extra == nil {
			extra = map[string]any{}
		}
		var val any
		if err := json.Unmarshal(v, &val); err != nil {
			return nil, err
		}
		extra[k] = val
	}
	return extra, nil
}

// UnmarshalJSON reads an OptionsSlot in its polymorphic shape, routing unknown
// keys into Extra and rejecting every ForbiddenMetaKey first.
func (s *OptionsSlot) UnmarshalJSON(data []byte) error {
	if b, ok := scalarBool(data); ok {
		s.Cancel = !b
		s.Bare = b
		return nil
	}
	if err := rejectForbiddenKeys(data, "options"); err != nil {
		return err
	}
	type alias OptionsSlot
	var a alias
	if err := json.Unmarshal(data, &a); err != nil {
		return err
	}
	*s = OptionsSlot(a)
	extra, err := extraKeys(data, optionsNamedKeys)
	if err != nil {
		return err
	}
	s.Extra = extra
	return nil
}

// Items is the choice source: a static array (Static), a static value→label map
// (StaticMap, G3), or a dynamic source. It is the dependency-isolation bucket
// for the items target — dynamic-source keys live here, not at top level.
//
// A static value→label map (SPEC §2 G3) has the option VALUE as the KEY and the
// display label (string | LangMap | null) as the value. The label is display-only
// and never a membership value; an empty (null) label has no effect.
//
// A dynamic source is STRUCTURE ONLY. The supported shape
// (type: search) is a Model (a name string OR a nested {table, relations, keys}
// relational query) plus a sibling ApiServer (a runtime HTTP-endpoint fn
// reference) plus a placeholder static Items. Model / ApiServer / Items are kept
// as raw JSON and preserved verbatim — the engine never runs the query or calls
// the endpoint. Runtime resolution is out of scope (SPEC §6 R1).
type Items struct {
	// Static is the static choice array, when items is a literal list.
	Static []any `json:"-"`

	// StaticMapKeys holds the value→label map keys in declaration order (the
	// option values), so the map round-trips in order.
	StaticMapKeys []string `json:"-"`
	// StaticMap is the value→label map: option value (key) → label (string |
	// LangMap | null), kept as raw JSON so any label shape round-trips.
	StaticMap map[string]json.RawMessage `json:"-"`

	// Model is the dynamic source model: a name string OR a nested
	// {table, relations, keys} query. Raw JSON so both shapes round-trip; the
	// runtime, not this model, builds and runs the query.
	Model json.RawMessage `json:"model,omitempty"`
	// Method is the dynamic source method.
	Method any `json:"method,omitempty"`
	// Table is the dynamic source table (top-level shorthand of model.table).
	Table any `json:"table,omitempty"`
	// Relations is the dynamic source relations.
	Relations any `json:"relations,omitempty"`
	// ApiServer is the runtime HTTP-endpoint fn reference (an opaque source
	// callback string). Preserved verbatim; the engine never calls it —
	// invoking the endpoint is runtime, out of scope.
	ApiServer json.RawMessage `json:"api_server,omitempty"`
	// PlaceholderItems is the placeholder static items that coexists with the
	// dynamic source (the pre-fetch choices shown before the source resolves,
	// often [] or a single {"": "선택하세요"} prompt). Raw JSON so the array /
	// value→label shapes round-trip; the runtime replaces it with fetched rows.
	PlaceholderItems json.RawMessage `json:"items,omitempty"`
}

// itemsDynamicKeys is the closed dynamic-source key set; an items object whose
// keys all fall inside it is a dynamic source, otherwise it is a static
// value→label map (G3). The placeholder "items" and the runtime fn reference
// "api_server" are part of the source descriptor (they coexist with model).
var itemsDynamicKeys = map[string]bool{
	"model": true, "method": true, "table": true, "relations": true,
	"api_server": true, "items": true,
}

// MarshalJSON emits Items as the static array, the static value→label map (in
// declaration order), else the dynamic source object.
func (i *Items) MarshalJSON() ([]byte, error) {
	if i == nil {
		return []byte("null"), nil
	}
	if i.Static != nil {
		return json.Marshal(i.Static)
	}
	if i.StaticMap != nil {
		return marshalOrdered(i.StaticMapKeys, i.StaticMap) // raw label (string | LangMap | null)
	}
	type alias Items
	return json.Marshal((*alias)(i))
}

// UnmarshalJSON reads Items as a static array, a static value→label map (G3), or
// a dynamic source object. An items object whose keys are not all dynamic-source
// keys is a static value→label map (key = option value, value = display label).
func (i *Items) UnmarshalJSON(data []byte) error {
	trimmed := bytes.TrimSpace(data)
	if len(trimmed) > 0 && trimmed[0] == '[' {
		var arr []any
		if err := json.Unmarshal(data, &arr); err != nil {
			return err
		}
		i.Static = arr
		return nil
	}
	if err := rejectForbiddenKeys(data, "items"); err != nil {
		return err
	}
	// Decide static value→label map vs dynamic source by the key set, preserving
	// declaration order via a token walk.
	keys, raw, err := orderedRawObject(data)
	if err != nil {
		return err
	}
	isDynamic := true
	for _, k := range keys {
		if !itemsDynamicKeys[k] {
			isDynamic = false
			break
		}
	}
	if !isDynamic {
		i.StaticMapKeys = keys
		i.StaticMap = raw
		return nil
	}
	type alias Items
	var a alias
	if err := json.Unmarshal(data, &a); err != nil {
		return err
	}
	*i = Items(a)
	return nil
}

// objectEntry is one member of a JSON object: its key and raw value, in document order.
type objectEntry struct {
	key   string
	value json.RawMessage
}

// objectOpen reads the first token of data. It returns the decoder and whether data opens an object.
func objectOpen(data []byte) (*json.Decoder, bool, error) {
	dec := json.NewDecoder(bytes.NewReader(data))
	tok, err := dec.Token()
	if err != nil {
		return nil, false, err
	}
	d, ok := tok.(json.Delim)
	return dec, ok && d == '{', nil
}

// objectEntries reads the members of the object that dec has opened, in document order, up to its closing brace.
func objectEntries(dec *json.Decoder) ([]objectEntry, error) {
	var entries []objectEntry
	for dec.More() {
		keyTok, err := dec.Token()
		if err != nil {
			return nil, err
		}
		key, ok := keyTok.(string)
		if !ok {
			return nil, fmt.Errorf("model: expected an object key, got %T", keyTok)
		}
		var rv json.RawMessage
		if err := dec.Decode(&rv); err != nil {
			return nil, err
		}
		entries = append(entries, objectEntry{key: key, value: rv})
	}
	return entries, nil
}

// orderedRawObject token-walks a JSON object into ordered keys and raw values; a repeated key keeps its first place and its last value.
func orderedRawObject(data []byte) ([]string, map[string]json.RawMessage, error) {
	dec, isObject, err := objectOpen(data)
	if err != nil {
		return nil, nil, err
	}
	if !isObject {
		return nil, nil, fmt.Errorf("model: items must be an array, a value→label map, or a dynamic source object")
	}
	entries, err := objectEntries(dec)
	if err != nil {
		return nil, nil, err
	}
	var keys []string
	values := map[string]json.RawMessage{}
	for _, entry := range entries {
		if _, dup := values[entry.key]; !dup {
			keys = append(keys, entry.key)
		}
		values[entry.key] = entry.value
	}
	if _, err := dec.Token(); err != nil { // consume '}'
		return nil, nil, err
	}
	return keys, values, nil
}

// Multiple is repeated rows (true = on) and the dependency-isolation bucket for
// the multiple target — repetition-control keys live under it, never at top
// level. Polymorphic false | {} | true | "only"; "only" is the same as
// {"only": true}, rows that exist only in the data (docs/spec/schema.md).
//
// Row identity is not a Multiple field. Repeated data is an object keyed by row
// identity, and object member order is row order; the specification has no
// hidden identity or order field (see docs/spec/form-runtime.md).
//
// multiple_max / sortable* / add_buttons / remove_list_button /
// list_button_text / multiple_button_onclick are NOT fields here; the canonical
// keys are max / sortable / copy / onclick (R2 / R4). multiple is a closed bucket:
// Unmarshal rejects any key not modeled below.
type Multiple struct {
	// Cancel is the false shape: multiple disabled (cancels a composed-in
	// multiple).
	Cancel bool `json:"-"`
	// Enabled is the true shape: the bare on switch with no body.
	Enabled bool `json:"-"`
	// DataOnly is the "only" shape: rows come only from the data.
	DataOnly bool `json:"-"`

	// Only declares rows that exist only in the data.
	Only any `json:"only,omitempty"`
	// Min is the minimum row count.
	Min any `json:"min,omitempty"`
	// Max caps the row count.
	Max any `json:"max,omitempty"`
	// Copy toggles the row copy control.
	Copy any `json:"copy,omitempty"`
	// Sortable toggles row reordering.
	Sortable any `json:"sortable,omitempty"`
	// Title names the direct child field whose value titles each row.
	Title any `json:"title,omitempty"`
	// Controls positions row controls: header, footer or outline.
	Controls any `json:"controls,omitempty"`
	// Header selects static or sticky row headers.
	Header any `json:"header,omitempty"`
	// Onclick is the row-action script.
	Onclick any `json:"onclick,omitempty"`
}

// MarshalJSON emits Multiple as false, true, or the body object.
func (m *Multiple) MarshalJSON() ([]byte, error) {
	if m == nil {
		return []byte("null"), nil
	}
	if m.Cancel {
		return []byte("false"), nil
	}
	if m.Enabled {
		return []byte("true"), nil
	}
	if m.DataOnly {
		return []byte(`"only"`), nil
	}
	type alias Multiple
	return json.Marshal((*alias)(m))
}

// UnmarshalJSON reads Multiple in its polymorphic false | {} | true | "only"
// shape.
func (m *Multiple) UnmarshalJSON(data []byte) error {
	if b, ok := scalarBool(data); ok {
		m.Cancel = !b
		m.Enabled = b
		return nil
	}
	if string(bytes.TrimSpace(data)) == `"only"` {
		*m = Multiple{DataOnly: true}
		return nil
	}
	if err := rejectForbiddenKeys(data, "multiple"); err != nil {
		return err
	}
	if err := rejectUnknownKeys(data, "multiple", []string{"only", "min", "max", "copy", "sortable", "title", "controls", "header", "onclick"}); err != nil {
		return err
	}
	type alias Multiple
	var a alias
	if err := json.Unmarshal(data, &a); err != nil {
		return err
	}
	*m = Multiple(a)
	return nil
}

// Lang is the input-multilingual dimension (the field value is per language,
// G3 axis 2) and the dependency-isolation bucket for the lang target —
// multilingual control keys live under it, never at top level. Same structural
// axis as Multiple. Polymorphic false | {} | true.
//
// lang:append / langs / lang_name / lang_key / remove_lang_frame /
// remove_lang_title / lang_group_class are NOT fields here; the canonical keys
// are mode / only / name / key / frame / title / group_class (R2 / R4). The magic
// `:` token in lang:append is rejected outright. lang is a closed bucket:
// Unmarshal rejects any key not modeled below.
type Lang struct {
	// Cancel is the false shape: lang disabled (cancels a composed-in lang).
	Cancel bool `json:"-"`
	// Enabled is the true shape: the bare on switch with no body.
	Enabled bool `json:"-"`

	// Mode is the multilingual mode.
	Mode any `json:"mode,omitempty"`
	// Only has two shapes (SPEC §3 C): a language allowlist []string
	// (["ko","en"]) OR a per-language override map
	// map[string]{validate/design/behavior/options} ({ja:{validate:…}}). The
	// allowlist restricts rendered languages; the override map redefines role
	// slots per language. Held as any so both shapes round-trip.
	Only any `json:"only,omitempty"`
	// Name is the per-language name binding.
	Name any `json:"name,omitempty"`
	// Key is the per-language key binding.
	Key any `json:"key,omitempty"`
	// Frame toggles the language frame.
	Frame any `json:"frame,omitempty"`
	// Title is the language-frame title.
	Title any `json:"title,omitempty"`
	// GroupClass is the language group's appearance class.
	GroupClass any `json:"group_class,omitempty"`
}

// MarshalJSON emits Lang as false, true, or the body object.
func (l *Lang) MarshalJSON() ([]byte, error) {
	if l == nil {
		return []byte("null"), nil
	}
	if l.Cancel {
		return []byte("false"), nil
	}
	if l.Enabled {
		return []byte("true"), nil
	}
	type alias Lang
	return json.Marshal((*alias)(l))
}

// UnmarshalJSON reads Lang in its polymorphic false | {} | true shape.
func (l *Lang) UnmarshalJSON(data []byte) error {
	if b, ok := scalarBool(data); ok {
		l.Cancel = !b
		l.Enabled = b
		return nil
	}
	if err := rejectForbiddenKeys(data, "lang"); err != nil {
		return err
	}
	if err := rejectUnknownKeys(data, "lang", []string{"mode", "only", "name", "key", "frame", "title", "group_class"}); err != nil {
		return err
	}
	type alias Lang
	var a alias
	if err := json.Unmarshal(data, &a); err != nil {
		return err
	}
	*l = Lang(a)
	return nil
}

// CompositionDirective is a composition key. $ref expands first (base
// inheritance from a file / path; an unresolved $ref cannot load), then $patch
// applies changes (add / remove / replace, JSON-Patch style, with deep-path set
// support). Resolution order: $ref → $patch → single spec → field layer.
// $after / $before / $merge / $remove are forbidden meta keys; $patch expresses
// those changes.
type CompositionDirective struct {
	// Ref is base inheritance (file / path). It expands before anything else.
	Ref any `json:"$ref,omitempty"`
	// Patch is the change set (add / remove / replace), applied after $ref.
	Patch any `json:"$patch,omitempty"`
}

// CompositionDirectives is the closed set of recognized composition keys.
var CompositionDirectives = []string{"$ref", "$patch"}

// ForbiddenMetaKeys are keys that must never appear in a model document, at ANY
// depth. They have no field on any model struct; every Unmarshal that owns an open
// bucket (and every typed slot / structure key) rejects them via
// rejectForbiddenKeys. A schema layer expresses the same with
// propertyNames:{not:{enum:[…]}}.
//
// Condition-only meta keys (display_switch / display_target / if / when /
// show_if) are gone — conditions live in condition maps and design.show.
// Convention sigils (_) are gone; $after / $before / $merge / $remove are
// expressed with $patch; xclass / xstyle fold into the design node
// map. The x{key} comment pattern is handled by ForbiddenKeyPrefix, not this
// literal list.
var ForbiddenMetaKeys = []string{
	"display_switch",
	"display_target",
	"if",
	"when",
	"show_if",
	"_",
	"seqtokey",
	"__13hex__",
	"$after",
	"$before",
	"$merge",
	"$remove",
	"xclass",
	"xstyle",
}

// ForbiddenKeyPrefix is the x{key} comment prefix. A meta-schema x-strips such
// keys before validating the canonical spec; the strip is the documented reason
// a raw x-prefixed key never legitimately reaches this model, so any survivor is
// rejected. (xclass / xstyle are also listed literally above for clarity.)
const ForbiddenKeyPrefix = "x"

// forbiddenSet is the O(1) lookup form of ForbiddenMetaKeys.
var forbiddenSet = func() map[string]bool {
	m := make(map[string]bool, len(ForbiddenMetaKeys))
	for _, k := range ForbiddenMetaKeys {
		m[k] = true
	}
	return m
}()

// scalarBool reports whether data is the JSON literal true or false, returning
// the boolean. It distinguishes the polymorphic false / true slot shapes from the
// {} body shape.
func scalarBool(data []byte) (bool, bool) {
	switch string(bytes.TrimSpace(data)) {
	case "true":
		return true, true
	case "false":
		return false, true
	default:
		return false, false
	}
}

// rejectForbiddenKeys decodes the top-level keys of a JSON object and errors if
// any is a ForbiddenMetaKey or carries the x{key} comment prefix. It is the
// runtime guard that mirrors the schema's propertyNames:{not:{enum:[…]}} and is
// invoked one level under every open bucket and typed shape. Non-object input is
// a no-op (the caller's typed Unmarshal handles non-objects).
func rejectForbiddenKeys(data []byte, where string) error {
	dec := json.NewDecoder(bytes.NewReader(data))
	tok, err := dec.Token()
	if err != nil {
		return err
	}
	d, ok := tok.(json.Delim)
	if !ok || d != '{' {
		return nil
	}
	for dec.More() {
		keyTok, err := dec.Token()
		if err != nil {
			return err
		}
		key, ok := keyTok.(string)
		if !ok {
			return fmt.Errorf("model: expected object key in %s", where)
		}
		if forbiddenSet[key] {
			return fmt.Errorf("model: forbidden meta key %q in %s", key, where)
		}
		if key != "_" && strings.HasPrefix(key, ForbiddenKeyPrefix) && isXCommentKey(key) {
			return fmt.Errorf("model: x-comment key %q in %s must be x-stripped by the meta-schema before validation", key, where)
		}
		// skip the value
		if err := skipValue(dec); err != nil {
			return err
		}
	}
	return nil
}

// rejectUnknownKeys errors on the first key, in specification member order, of a
// closed bucket object that allowed does not list. Non-object input is a no-op
// (the caller's typed Unmarshal handles non-objects).
func rejectUnknownKeys(data []byte, where string, allowed []string) error {
	value, err := compose.DecodeOrdered(data)
	if err != nil {
		return err
	}
	bucket, ok := compose.OrderMembers(value).(*compose.OMap)
	if !ok {
		return nil
	}
	for _, key := range bucket.Keys() {
		if !slices.Contains(allowed, key) {
			return fmt.Errorf("model: unknown key %q in %s", key, where)
		}
	}
	return nil
}

// objectMembers returns the keys and raw values of a JSON object in declaration
// order. Non-object input yields no members.
func objectMembers(data []byte) ([]string, []json.RawMessage, error) {
	dec, isObject, err := objectOpen(data)
	if err != nil {
		return nil, nil, err
	}
	if !isObject {
		return nil, nil, nil
	}
	entries, err := objectEntries(dec)
	if err != nil {
		return nil, nil, err
	}
	var keys []string
	var values []json.RawMessage
	for _, entry := range entries {
		keys = append(keys, entry.key)
		values = append(values, entry.value)
	}
	return keys, values, nil
}

// isXCommentKey reports whether key is an x{key} comment key: a lowercase x
// followed by a letter (xclass, xstyle, xfoo). Real keys like "x" alone or
// hyphenated schema keywords are not treated as comments by this heuristic; the
// authoritative strip belongs to the meta-schema.
func isXCommentKey(key string) bool {
	if len(key) < 2 || key[0] != 'x' {
		return false
	}
	c := key[1]
	return (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z')
}

// skipValue consumes one JSON value from the decoder, descending through nested
// objects and arrays so the next token is the following object key.
func skipValue(dec *json.Decoder) error {
	tok, err := dec.Token()
	if err != nil {
		return err
	}
	if d, ok := tok.(json.Delim); ok && (d == '{' || d == '[') {
		for dec.More() {
			if d == '{' {
				if _, err := dec.Token(); err != nil { // key
					return err
				}
			}
			if err := skipValue(dec); err != nil {
				return err
			}
		}
		if _, err := dec.Token(); err != nil { // closing delim
			return err
		}
	}
	return nil
}
