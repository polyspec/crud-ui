package generator

import (
	"fmt"
	"regexp"
	"strconv"
	"strings"
	"time"
)

var isoDate = regexp.MustCompile(`^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2})(?::(\d{2})(?:\.(\d+))?)?(Z|[+-]\d{2}:\d{2})?)?$`)
var rfcDate = regexp.MustCompile(`(?i)^(?:(Mon|Tue|Wed|Thu|Fri|Sat|Sun),[ \t]+)?(\d{1,2})[ \t]+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[ \t]+(\d{4})[ \t]+(\d{2}):(\d{2})(?::(\d{2}))?[ \t]+([+-]\d{4}|UT|GMT|EST|EDT|CST|CDT|MST|MDT|PST|PDT)$`)
var dateZones = map[string]int{"UT": 0, "GMT": 0, "EST": -5 * 3600, "EDT": -4 * 3600, "CST": -6 * 3600, "CDT": -5 * 3600, "MST": -7 * 3600, "MDT": -6 * 3600, "PST": -8 * 3600, "PDT": -7 * 3600}

// dateInteger reads a digit run that isoDate or rfcDate matched. An optional group that the pattern
// did not match is "", which reads as 0 (a date without a time, or a time without seconds).
func dateInteger(value string) int {
	if value == "" {
		return 0
	}
	n, err := strconv.Atoi(value)
	if err != nil {
		panic(fmt.Sprintf("date: %q is not a digit run matched by a date pattern: %v", value, err))
	}
	return n
}
func dateOffset(value string) (int, bool) {
	if value == "" || value == "Z" {
		return 0, true
	}
	if offset, ok := dateZones[strings.ToUpper(value)]; ok {
		return offset, true
	}
	value = strings.ReplaceAll(value, ":", "")
	hours, minutes := dateInteger(value[1:3]), dateInteger(value[3:5])
	if hours > 23 || minutes > 59 {
		return 0, false
	}
	offset := (hours*60 + minutes) * 60
	if value[0] == '-' {
		offset = -offset
	}
	return offset, true
}

func parseDate(value string) (time.Time, bool) {
	var year, month, day, hour, minute, second int
	var zone, weekday, fraction string
	if match := isoDate.FindStringSubmatch(value); match != nil {
		year, month, day = dateInteger(match[1]), dateInteger(match[2]), dateInteger(match[3])
		hour, minute, second = dateInteger(match[4]), dateInteger(match[5]), dateInteger(match[6])
		fraction, zone = match[7], match[8]
	} else if match := rfcDate.FindStringSubmatch(value); match != nil {
		weekday, day, month, year = strings.ToLower(match[1]), dateInteger(match[2]), strings.Index("janfebmaraprmayjunjulaugsepoctnovdec", strings.ToLower(match[3]))/3+1, dateInteger(match[4])
		hour, minute, second, zone = dateInteger(match[5]), dateInteger(match[6]), dateInteger(match[7]), match[8]
	} else {
		return time.Time{}, false
	}
	if month < 1 || month > 12 || day < 1 || day > 31 || hour > 23 || minute > 59 || second > 59 {
		return time.Time{}, false
	}
	offset, ok := dateOffset(zone)
	if !ok {
		return time.Time{}, false
	}
	nanosecond := 0
	if fraction != "" {
		if len(fraction) > 9 {
			fraction = fraction[:9]
		}
		nanosecond = dateInteger(fraction + strings.Repeat("0", 9-len(fraction)))
	}
	date := time.Date(year, time.Month(month), day, hour, minute, second, nanosecond, time.FixedZone("", offset))
	if date.Year() != year || int(date.Month()) != month || date.Day() != day {
		return time.Time{}, false
	}
	if weekday != "" && strings.ToLower(date.Weekday().String()[:3]) != weekday {
		return time.Time{}, false
	}
	return date.UTC(), true
}

func dateValue(value string) string {
	if date, ok := parseDate(value); ok {
		return date.Format("2006-01-02")
	}
	return value
}
func datetimeValue(value string) string {
	if date, ok := parseDate(value); ok {
		return date.Format("2006-01-02T15:04:05")
	}
	return value
}
