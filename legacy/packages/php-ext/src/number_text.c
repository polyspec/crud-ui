#include "engine_internal.h"
#include "bignum_internal.h"

#include <math.h>
#include <stdlib.h>
#include <string.h>

/*
 * Locale-independent number text. strtod and printf depend on the C locale (a comma decimal
 * separator, for example) and on the platform, so the engine reads and writes numbers here, with
 * exact unsigned big-integer arithmetic and only the C library's ldexp:
 * - numeric text (the HTML valid floating-point number) and the C number syntax strtod reads in
 *   the "C" locale are converted to the nearest double (round half to even, gradual underflow);
 * - "%.*g" is written from the exact decimal value of a double, rounded half to even.
 * This unit depends on nothing else in the engine.
 */

/* A kept significand has at most this many decimal digits; a midpoint between two doubles has
   at most 767 significant digits, so a nonzero digit beyond them only needs to be remembered. */
#define KEPT_DIGITS 800
/* 5120 bits: 10^1125 (the largest divisor) shifted by 64 bits fits. */
#define NUMBER_WORDS 160

typedef struct {
    uint32_t words[NUMBER_WORDS];
    size_t used;
} number_big;

static void big_from(number_big *value, uint32_t number)
{
    value->used = number ? 1 : 0;
    value->words[0] = number;
}

/* value = value * factor + addend; the bounds above keep every product inside the words, so no carry is left over. */
static void big_mul_add(number_big *value, uint32_t factor, uint32_t addend)
{
    (void)bignum_mul_add(value->words, &value->used, NUMBER_WORDS, factor, addend);
}

static void big_mul_pow10(number_big *value, uint64_t exponent)
{
    for (; exponent >= 9; exponent -= 9) big_mul_add(value, 1000000000u, 0);
    static const uint32_t powers[] = {1, 10, 100, 1000, 10000, 100000, 1000000, 10000000, 100000000};
    if (exponent) big_mul_add(value, powers[exponent], 0);
}

static size_t big_bits(const number_big *value)
{
    if (!value->used) return 0;
    uint32_t top = value->words[value->used - 1];
    size_t bits = (value->used - 1) * 32;
    while (top) { bits++; top >>= 1; }
    return bits;
}

static void big_shift_left(const number_big *value, size_t bits, number_big *out)
{
    size_t whole = bits / 32;
    unsigned part = (unsigned)(bits % 32);
    if (!value->used) { out->used = 0; return; }
    size_t used = value->used + whole + 1;
    if (used > NUMBER_WORDS) used = NUMBER_WORDS;
    memset(out->words, 0, used * sizeof(out->words[0]));
    for (size_t i = 0; i < value->used && i + whole < NUMBER_WORDS; ++i) {
        out->words[i + whole] |= value->words[i] << part;
        if (part && i + whole + 1 < NUMBER_WORDS) out->words[i + whole + 1] |= value->words[i] >> (32 - part);
    }
    out->used = used;
    while (out->used && !out->words[out->used - 1]) out->used--;
}

static int big_compare(const number_big *left, const number_big *right)
{
    return bignum_compare(left->words, left->used, right->words, right->used);
}

/* left -= right, with left >= right. */
static void big_subtract(number_big *left, const number_big *right)
{
    uint64_t borrow = 0;
    for (size_t i = 0; i < left->used; ++i) {
        uint64_t subtrahend = (i < right->used ? right->words[i] : 0) + borrow;
        uint64_t word = left->words[i];
        borrow = word < subtrahend;
        left->words[i] = (uint32_t)(word + (borrow ? UINT64_C(0x100000000) : 0) - subtrahend);
    }
    while (left->used && !left->words[left->used - 1]) left->used--;
}

/* The bit at index of a big integer. */
static unsigned big_bit(const number_big *value, size_t index)
{
    return index / 32 < value->used ? (value->words[index / 32] >> (index % 32)) & 1u : 0;
}

/*
 * The nonnegative double nearest to (q + f) * 2^-k with 0 <= f < 1, where sticky tells whether f
 * is nonzero and q has at least 63 bits (so at least 10 bits are dropped); false when it overflows.
 */
static bool round_double(uint64_t q, bool sticky, int64_t k, double *out)
{
    int64_t length = 0;
    for (uint64_t rest = q; rest; rest >>= 1) length++;
    int64_t binary = length - 1 - k;
    if (binary > 1023) return false;
    int64_t unit = binary - 52 < -1074 ? -1074 : binary - 52;
    int64_t drop = unit + k;
    uint64_t kept = 0, remainder = q, half = UINT64_C(1) << 63;
    /* Below half of the unit: (q + f) < 2^64 <= 2^(drop - 1). */
    if (drop > 64) { *out = 0; return true; }
    if (drop < 64) {
        kept = q >> drop;
        remainder = q & ((UINT64_C(1) << drop) - 1);
        half = UINT64_C(1) << (drop - 1);
    }
    if (remainder > half || (remainder == half && (sticky || (kept & 1)))) kept++;
    double result = ldexp((double)kept, (int)unit);
    if (!isfinite(result)) return false;
    *out = result;
    return true;
}

/*
 * The double nearest to the decimal digits in bytes[integer_start, fraction_end) (a '.' among them
 * is skipped; fraction_start is where the fraction digits begin) times 10^exponent. False when it
 * overflows, with *number set to the infinity of its sign.
 */
static bool decimal_value(const char *bytes, size_t integer_start, size_t fraction_start,
                          size_t fraction_end, int64_t exponent, bool negative, double *number)
{
    /* The significand: the first kept significant digits, then a 1 for any nonzero digit after them. */
    number_big numbers[3];
    number_big *significand = numbers, *work = numbers + 1, *scratch = numbers + 2;
    big_from(significand, 0);
    int64_t kept = 0, remaining = 0;
    bool sticky = false;
    for (size_t i = integer_start; i < fraction_end; ++i) {
        if (bytes[i] == '.') continue;
        unsigned digit = (unsigned)(bytes[i] - '0');
        if (!kept && !digit) continue;
        if (kept < KEPT_DIGITS) { big_mul_add(significand, 10, digit); kept++; }
        else { remaining++; sticky = sticky || digit; }
    }
    if (sticky) { big_mul_add(significand, 10, 1); kept++; remaining--; }
    double result = 0;
    bool finite = true;
    int64_t scale = remaining - (int64_t)(fraction_end - fraction_start) + exponent;
    if (!kept || kept + scale < -324) result = 0;
    else if (kept + scale > 310) finite = false;
    else if (scale >= 0) {
        big_mul_pow10(significand, (uint64_t)scale);
        size_t bits = big_bits(significand);
        uint64_t q = 0;
        bool rest = false;
        for (size_t i = 0; i < 64; ++i)
            if (bits >= 64 - i) q |= (uint64_t)big_bit(significand, bits - 64 + i) << i;
        for (size_t i = 0; bits > 64 && i < bits - 64; ++i) rest = rest || big_bit(significand, i);
        finite = round_double(q, rest, (int64_t)64 - (int64_t)bits, &result);
    } else {
        /* q = floor(significand * 2^k / 10^-scale) with 2^62 <= q < 2^64. */
        big_from(scratch, 1);
        big_mul_pow10(scratch, (uint64_t)-scale);
        int64_t k = 63 - ((int64_t)big_bits(significand) - (int64_t)big_bits(scratch));
        if (k >= 0) {
            big_shift_left(significand, (size_t)k, work);
            *significand = *work;
        } else {
            big_shift_left(scratch, (size_t)-k, work);
            *scratch = *work;
        }
        uint64_t q = 0;
        for (int bit = 63; bit >= 0; --bit) {
            big_shift_left(scratch, (size_t)bit, work);
            if (big_compare(significand, work) >= 0) {
                big_subtract(significand, work);
                q |= UINT64_C(1) << bit;
            }
        }
        finite = round_double(q, significand->used != 0, k, &result);
    }
    if (!finite) result = INFINITY;
    *number = negative ? -result : result;
    return finite;
}


bool ps_numeric_text(ps_text text, double *number)
{
    size_t index = 0, length = text.length;
    const char *bytes = text.bytes;
    bool negative = index < length && bytes[index] == '-';
    if (negative) index++;
    size_t integer_start = index;
    while (index < length && bytes[index] >= '0' && bytes[index] <= '9') index++;
    size_t integer_end = index, fraction_start = index, fraction_end = index;
    if (index < length && bytes[index] == '.') {
        fraction_start = ++index;
        while (index < length && bytes[index] >= '0' && bytes[index] <= '9') index++;
        fraction_end = index;
        if (fraction_end == fraction_start) return false;
    }
    if (integer_end == integer_start && fraction_end == fraction_start) return false;
    int64_t exponent = 0;
    if (index < length && (bytes[index] == 'e' || bytes[index] == 'E')) {
        index++;
        bool below = index < length && bytes[index] == '-';
        if (index < length && (bytes[index] == '-' || bytes[index] == '+')) index++;
        size_t start = index;
        for (; index < length && bytes[index] >= '0' && bytes[index] <= '9'; ++index)
            if (exponent < INT64_C(1000000000)) exponent = exponent * 10 + (bytes[index] - '0');
        if (index == start) return false;
        if (below) exponent = -exponent;
    }
    if (index != length) return false;
    return decimal_value(bytes, integer_start, fraction_start, fraction_end, exponent, negative, number);
}

static bool ascii_space(char c)
{
    return c == ' ' || c == '\t' || c == '\n' || c == '\v' || c == '\f' || c == '\r';
}

static int hex_digit(char c)
{
    if (c >= '0' && c <= '9') return c - '0';
    if (c >= 'a' && c <= 'f') return c - 'a' + 10;
    if (c >= 'A' && c <= 'F') return c - 'A' + 10;
    return -1;
}

/* Whether text at index starts with the lowercase word, ignoring ASCII case. */
static bool word_at(ps_text text, size_t index, const char *word)
{
    size_t length = strlen(word);
    if (text.length - index < length) return false;
    for (size_t i = 0; i < length; ++i) {
        char c = text.bytes[index + i];
        if (c >= 'A' && c <= 'Z') c = (char)(c - 'A' + 'a');
        if (c != word[i]) return false;
    }
    return true;
}

/* A signed exponent of decimal digits at *index, saturated; false without digits. */
static bool exponent_at(ps_text text, size_t *index, int64_t *exponent)
{
    size_t cursor = *index;
    bool below = cursor < text.length && text.bytes[cursor] == '-';
    if (cursor < text.length && (text.bytes[cursor] == '-' || text.bytes[cursor] == '+')) cursor++;
    size_t start = cursor;
    int64_t value = 0;
    for (; cursor < text.length && text.bytes[cursor] >= '0' && text.bytes[cursor] <= '9'; ++cursor)
        if (value < INT64_C(1000000000)) value = value * 10 + (text.bytes[cursor] - '0');
    if (cursor == start) return false;
    *exponent = below ? -value : value;
    *index = cursor;
    return true;
}

/* The double of hexadecimal digits in [start, end) (a '.' among them marks the fraction) times 2^power. */
static bool hex_value(ps_text text, size_t start, size_t end, int64_t power, bool negative, double *number)
{
    uint64_t q = 0;
    int64_t digits = 0, dropped = 0, fraction = 0;
    bool sticky = false, point = false;
    for (size_t i = start; i < end; ++i) {
        if (text.bytes[i] == '.') { point = true; continue; }
        int digit = hex_digit(text.bytes[i]);
        if (point) fraction++;
        if (!digits && !digit) continue;
        if (digits < 16) { q = q << 4 | (uint64_t)digit; digits++; }
        else { dropped++; sticky = sticky || digit; }
    }
    double result = 0;
    bool finite = true;
    if (q) {
        int shift = 0;
        while (!(q >> 63)) { q <<= 1; shift++; }
        int64_t k = shift - (4 * dropped - 4 * fraction + power);
        finite = round_double(q, sticky, k, &result);
        if (!finite) result = INFINITY;
    }
    *number = negative ? -result : result;
    return finite;
}

size_t ps_c_number(ps_text text, double *number, bool *overflow)
{
    size_t index = 0;
    *overflow = false;
    while (index < text.length && ascii_space(text.bytes[index])) index++;
    bool negative = index < text.length && text.bytes[index] == '-';
    if (index < text.length && (text.bytes[index] == '-' || text.bytes[index] == '+')) index++;
    if (word_at(text, index, "infinity")) { *number = negative ? -INFINITY : INFINITY; return index + 8; }
    if (word_at(text, index, "inf")) { *number = negative ? -INFINITY : INFINITY; return index + 3; }
    if (word_at(text, index, "nan")) {
        size_t end = index + 3;
        if (end < text.length && text.bytes[end] == '(') {
            size_t close = end + 1;
            while (close < text.length && (hex_digit(text.bytes[close]) >= 0 || text.bytes[close] == '_' ||
                   (text.bytes[close] >= 'g' && text.bytes[close] <= 'z') ||
                   (text.bytes[close] >= 'G' && text.bytes[close] <= 'Z'))) close++;
            if (close < text.length && text.bytes[close] == ')') end = close + 1;
        }
        *number = negative ? -NAN : NAN;
        return end;
    }
    if (index + 1 < text.length && text.bytes[index] == '0' && (text.bytes[index + 1] | 0x20) == 'x') {
        size_t cursor = index + 2, digits = 0;
        while (cursor < text.length && hex_digit(text.bytes[cursor]) >= 0) { cursor++; digits++; }
        if (cursor < text.length && text.bytes[cursor] == '.') {
            cursor++;
            while (cursor < text.length && hex_digit(text.bytes[cursor]) >= 0) { cursor++; digits++; }
        }
        if (digits) {
            size_t end = cursor;
            int64_t power = 0;
            if (cursor < text.length && (text.bytes[cursor] | 0x20) == 'p') {
                size_t after = cursor + 1;
                if (exponent_at(text, &after, &power)) end = after;
            }
            *overflow = !hex_value(text, index + 2, cursor, power, negative, number);
            return end;
        }
        /* "0x" without digits reads as 0. */
    }
    size_t integer_start = index;
    while (index < text.length && text.bytes[index] >= '0' && text.bytes[index] <= '9') index++;
    size_t fraction_start = index, fraction_end = index;
    if (index < text.length && text.bytes[index] == '.') {
        fraction_start = index + 1;
        fraction_end = fraction_start;
        while (fraction_end < text.length && text.bytes[fraction_end] >= '0' && text.bytes[fraction_end] <= '9')
            fraction_end++;
    }
    /* At least one digit before or after the point. */
    if (index == integer_start && fraction_end == fraction_start) return 0;
    index = fraction_end;
    int64_t exponent = 0;
    if (index < text.length && (text.bytes[index] | 0x20) == 'e') {
        size_t after = index + 1;
        if (exponent_at(text, &after, &exponent)) index = after;
    }
    *overflow = !decimal_value(text.bytes, integer_start, fraction_start, fraction_end, exponent, negative, number);
    return index;
}

/* value = value / divisor, returning the remainder. */
static uint32_t big_div_small(number_big *value, uint32_t divisor)
{
    uint64_t remainder = 0;
    for (size_t i = value->used; i-- > 0;) {
        uint64_t current = remainder << 32 | value->words[i];
        value->words[i] = (uint32_t)(current / divisor);
        remainder = current % divisor;
    }
    while (value->used && !value->words[value->used - 1]) value->used--;
    return (uint32_t)remainder;
}

/*
 * The exact decimal digits of a positive finite double, without leading zeros, and the decimal
 * exponent of the first digit. digits holds at least 800 bytes.
 */
static size_t exact_digits(double number, char *digits, int *exponent)
{
    uint64_t bits;
    memcpy(&bits, &number, sizeof(bits));
    int biased = (int)((bits >> 52) & 0x7ff);
    uint64_t f = bits & ((UINT64_C(1) << 52) - 1);
    if (biased) f |= UINT64_C(1) << 52;
    int e = biased ? biased - 1075 : -1074;
    number_big value, shifted;
    value.words[0] = (uint32_t)f;
    value.words[1] = (uint32_t)(f >> 32);
    value.used = value.words[1] ? 2 : 1;
    int scale = 0;
    if (e >= 0) {
        big_shift_left(&value, (size_t)e, &shifted);
        value = shifted;
    } else {
        /* f * 2^e = f * 5^-e * 10^e */
        for (int i = 0; i < -e; ++i) big_mul_add(&value, 5, 0);
        scale = e;
    }
    char reversed[1200];
    size_t count = 0;
    while (value.used) {
        uint32_t chunk = big_div_small(&value, 1000000000u);
        for (int i = 0; i < 9; ++i) { reversed[count++] = (char)('0' + chunk % 10); chunk /= 10; }
    }
    while (count > 1 && reversed[count - 1] == '0') count--;
    /* Trailing zeros carry no digits. */
    size_t low = 0;
    while (low + 1 < count && reversed[low] == '0') low++;
    for (size_t i = 0; i < count - low; ++i) digits[i] = reversed[count - 1 - i];
    *exponent = (int)count - 1 + scale;
    return count - low;
}

ps_chars ps_format_general(double number, int precision)
{
    char text[64];
    size_t length = 0;
    if (precision < 1) precision = 1;
    if (precision > 17) precision = 17;
    if (signbit(number) && !isnan(number)) text[length++] = '-';
    double absolute = fabs(number);
    if (isnan(number)) { memcpy(text + length, "nan", 3); length += 3; }
    else if (isinf(number)) { memcpy(text + length, "inf", 3); length += 3; }
    else if (absolute == 0) text[length++] = '0';
    else {
        char digits[1200];
        int exponent;
        size_t count = exact_digits(absolute, digits, &exponent);
        if (count > (size_t)precision) {
            char next = digits[precision];
            bool rest = false;
            for (size_t i = (size_t)precision + 1; i < count && !rest; ++i) rest = digits[i] != '0';
            bool up = next > '5' || (next == '5' && (rest || (digits[precision - 1] - '0') % 2));
            count = (size_t)precision;
            for (size_t i = count; up && i-- > 0;) {
                if (digits[i] == '9') { digits[i] = '0'; continue; }
                digits[i]++;
                up = false;
            }
            if (up) { digits[0] = '1'; count = 1; exponent++; }
        }
        while (count > 1 && digits[count - 1] == '0') count--;
        if (exponent < -4 || exponent >= precision) {
            length = ps_append_mantissa(text, length, digits, count);
            int power = exponent < 0 ? -exponent : exponent;
            text[length++] = 'e';
            text[length++] = exponent < 0 ? '-' : '+';
            if (power >= 100) text[length++] = (char)('0' + power / 100);
            text[length++] = (char)('0' + power / 10 % 10);
            text[length++] = (char)('0' + power % 10);
        } else if (exponent < 0) {
            text[length++] = '0';
            text[length++] = '.';
            for (int i = -1; i > exponent; --i) text[length++] = '0';
            memcpy(text + length, digits, count);
            length += count;
        } else {
            for (size_t i = 0; i <= (size_t)exponent; ++i) text[length++] = i < count ? digits[i] : '0';
            if (count > (size_t)exponent + 1) {
                text[length++] = '.';
                memcpy(text + length, digits + exponent + 1, count - (size_t)exponent - 1);
                length += count - (size_t)exponent - 1;
            }
        }
    }
    char *bytes = malloc(length + 1);
    if (!bytes) return (ps_chars){NULL, 0};
    memcpy(bytes, text, length);
    bytes[length] = '\0';
    return (ps_chars){bytes, length};
}
