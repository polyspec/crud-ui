package generator

import "strings"

type styleDeclaration struct{ property, value string }

func parseStyle(source string) []styleDeclaration {
	out := []styleDeclaration{}
	start, colon := 0, -1
	var quote byte
	depth := 0
	comment := false
	escapeNext := false
	consume := func(end int) {
		if colon < start {
			return
		}
		property := strings.TrimSpace(removeStyleComments(source[start:colon]))
		value := strings.TrimSpace(source[colon+1 : end])
		if property != "" && value != "" {
			out = append(out, styleDeclaration{property, value})
		}
	}
	for i := 0; i < len(source); i++ {
		c := source[i]
		if comment {
			if c == '*' && i+1 < len(source) && source[i+1] == '/' {
				comment = false
				i++
			}
			continue
		}
		if escapeNext {
			escapeNext = false
			continue
		}
		if c == '\\' {
			escapeNext = true
			continue
		}
		if quote != 0 {
			if c == quote {
				quote = 0
			}
			continue
		}
		if c == '/' && i+1 < len(source) && source[i+1] == '*' {
			comment = true
			i++
			continue
		}
		if c == '\'' || c == '"' {
			quote = c
			continue
		}
		switch c {
		case '(', '[', '{':
			depth++
		case ')', ']', '}':
			if depth > 0 {
				depth--
			}
		case ':':
			if depth == 0 && colon < start {
				colon = i
			}
		case ';':
			if depth == 0 {
				consume(i)
				start = i + 1
				colon = -1
			}
		}
	}
	consume(len(source))
	return out
}
func removeStyleComments(source string) string {
	var out strings.Builder
	for len(source) > 0 {
		at := strings.Index(source, "/*")
		if at < 0 {
			out.WriteString(source)
			break
		}
		out.WriteString(source[:at])
		end := strings.Index(source[at+2:], "*/")
		out.WriteByte(' ')
		if end < 0 {
			break
		}
		source = source[at+2+end+2:]
	}
	return out.String()
}
