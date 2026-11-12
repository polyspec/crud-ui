package validate

// FormInputError reports submitted form data whose shape does not match the
// specification. It is a validation failure without a validation result,
// distinct from a composition load failure.
type FormInputError struct {
	// Message names the rule and the data path.
	Message string
}

// Error implements the error interface.
func (e *FormInputError) Error() string {
	return e.Message
}

// Code returns the stable machine-readable code shared with the form runtime.
func (e *FormInputError) Code() string {
	return "INVALID_FORM_INPUT"
}
