package generator

import (
	"fmt"
	"math"
	"math/big"
	"regexp"
	"strconv"
	"strings"
	"unicode"
)

var decimalNumber = regexp.MustCompile(`^[+-]?(?:Infinity|(?:[0-9]+(?:\.[0-9]*)?|\.[0-9]+)(?:[eE][+-]?[0-9]+)?)$`)
var radixNumber = regexp.MustCompile(`^0(?:[xX][0-9a-fA-F]+|[bB][01]+|[oO][0-7]+)$`)

func parseNumberString(value string) (float64, bool) {
	value = strings.TrimFunc(value, func(r rune) bool { return r == 0xfeff || (r != 0x85 && unicode.IsSpace(r)) })
	if value == "" {
		return 0, true
	}
	if radixNumber.MatchString(value) {
		base := 16
		switch value[1] {
		case 'b', 'B':
			base = 2
		case 'o', 'O':
			base = 8
		}
		integer, ok := new(big.Int).SetString(value[2:], base)
		if !ok {
			return 0, false
		}
		number, _ := integer.Float64()
		return number, true
	}
	if !decimalNumber.MatchString(value) {
		return 0, false
	}
	number, err := strconv.ParseFloat(value, 64)
	return number, err == nil
}

func numberString(n float64) string {
	if n == 0 {
		return "0"
	}
	magnitude := math.Abs(n)
	if magnitude >= 1e-6 && magnitude < 1e21 {
		return strconv.FormatFloat(n, 'f', -1, 64)
	}
	s := strconv.FormatFloat(n, 'e', -1, 64)
	parts := strings.Split(s, "e")
	if len(parts) != 2 {
		return s
	}
	// FormatFloat writes the exponent as a signed decimal, so Atoi cannot fail for it.
	exponent, err := strconv.Atoi(parts[1])
	if err != nil {
		panic(fmt.Sprintf("numberString: exponent %q of %v: %v", parts[1], n, err))
	}
	sign := ""
	if exponent >= 0 {
		sign = "+"
	}
	return parts[0] + "e" + sign + strconv.Itoa(exponent)
}

// fixedNumber rounds the exact binary value to the nearest decimal, with ties away from zero.
func fixedNumber(n float64, decimals int) string {
	if math.Abs(n) >= 1e21 {
		return numberString(n)
	}
	negative := n < 0
	rational := new(big.Rat).SetFloat64(math.Abs(n))
	scale := new(big.Int).Exp(big.NewInt(10), big.NewInt(int64(decimals)), nil)
	numerator := new(big.Int).Mul(rational.Num(), scale)
	rounded, remainder := new(big.Int), new(big.Int)
	rounded.QuoRem(numerator, rational.Denom(), remainder)
	if new(big.Int).Lsh(remainder, 1).Cmp(rational.Denom()) >= 0 {
		rounded.Add(rounded, big.NewInt(1))
	}
	digits := rounded.String()
	if decimals > 0 {
		if len(digits) <= decimals {
			digits = strings.Repeat("0", decimals-len(digits)+1) + digits
		}
		at := len(digits) - decimals
		digits = digits[:at] + "." + digits[at:]
	}
	if negative {
		return "-" + digits
	}
	return digits
}
