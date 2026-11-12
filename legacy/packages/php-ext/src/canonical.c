#include "engine_internal.h"
#include "bignum_internal.h"

#include <math.h>
#include <stdio.h>
#include <stdlib.h>
#include <string.h>

/*
 * Canonical text of a scalar (docs/spec/validation-rules.md, "Values"): a string itself, true as
 * 1 and false as 0, and a number as ECMAScript Number.prototype.toString writes its double (an
 * integer is first converted to the nearest double).
 *
 * The digits of a double are generated exactly with the free-format algorithm of Burger and
 * Dybvig ("Printing Floating-Point Numbers Quickly and Accurately", 1996) on unsigned big
 * integers: the fewest digits that read back as the same double, and among those the digits
 * closest to its exact value, an exact tie choosing the even digit (ECMA-262, Number::toString).
 */

/* 1536 bits; the largest intermediate value of a double stays below 2^1100. */
#define BIG_WORDS 48

typedef struct {
    uint32_t words[BIG_WORDS];
    size_t used;
    bool overflow;
} big;

static void big_set(big *value, uint64_t number)
{
    memset(value, 0, sizeof(*value));
    value->words[0] = (uint32_t)number;
    value->words[1] = (uint32_t)(number >> 32);
    value->used = value->words[1] ? 2 : value->words[0] ? 1 : 0;
}

static void big_normalize(big *value)
{
    while (value->used && !value->words[value->used - 1]) value->used--;
}

static void big_mul_small(big *value, uint32_t factor)
{
    if (!bignum_mul_add(value->words, &value->used, BIG_WORDS, factor, 0)) value->overflow = true;
}

static void big_shift_left(big *value, unsigned bits)
{
    if (!value->used) return;
    size_t whole = bits / 32;
    unsigned part = bits % 32;
    if (value->used + whole + 1 > BIG_WORDS) { value->overflow = true; return; }
    uint32_t words[BIG_WORDS] = {0};
    for (size_t i = 0; i < value->used; ++i) {
        words[i + whole] |= value->words[i] << part;
        if (part) words[i + whole + 1] |= value->words[i] >> (32 - part);
    }
    memcpy(value->words, words, sizeof(words));
    value->used += whole + 1;
    big_normalize(value);
}

static void big_mul_pow10(big *value, unsigned exponent)
{
    while (exponent >= 9) { big_mul_small(value, 1000000000u); exponent -= 9; }
    static const uint32_t powers[] = {1, 10, 100, 1000, 10000, 100000, 1000000, 10000000, 100000000};
    if (exponent) big_mul_small(value, powers[exponent]);
}

static int big_compare(const big *left, const big *right)
{
    return bignum_compare(left->words, left->used, right->words, right->used);
}

static void big_add(const big *left, const big *right, big *sum)
{
    const big *longer = left->used >= right->used ? left : right;
    const big *shorter = longer == left ? right : left;
    big result = *longer;
    result.overflow = left->overflow || right->overflow;
    uint64_t carry = 0;
    for (size_t i = 0; i < longer->used; ++i) {
        uint64_t total = (uint64_t)longer->words[i] + (i < shorter->used ? shorter->words[i] : 0) + carry;
        result.words[i] = (uint32_t)total;
        carry = total >> 32;
    }
    if (carry) {
        if (result.used == BIG_WORDS) result.overflow = true;
        else result.words[result.used++] = (uint32_t)carry;
    }
    *sum = result;
}

/* left -= right, with left >= right. */
static void big_subtract(big *left, const big *right)
{
    int64_t borrow = 0;
    for (size_t i = 0; i < left->used; ++i) {
        int64_t difference = (int64_t)left->words[i] - (i < right->used ? right->words[i] : 0) - borrow;
        borrow = difference < 0;
        left->words[i] = (uint32_t)(difference + (borrow ? INT64_C(0x100000000) : 0));
    }
    big_normalize(left);
}

/* The compared sum left + right against value. */
static int big_sum_compare(const big *left, const big *right, const big *value)
{
    big sum;
    big_add(left, right, &sum);
    return big_compare(&sum, value);
}

/*
 * The shortest digits of a positive finite double: digits[0..count) with the value
 * 0.d1d2... * 10^exponent. Returns false only when an intermediate exceeds the big integer size,
 * which a double cannot cause.
 */
static bool shortest_digits(double number, char *digits, size_t *count, int *exponent)
{
    uint64_t bits;
    memcpy(&bits, &number, sizeof(bits));
    uint64_t fraction = bits & ((UINT64_C(1) << 52) - 1);
    int biased = (int)((bits >> 52) & 0x7ff);
    uint64_t f = biased ? fraction | (UINT64_C(1) << 52) : fraction;
    int e = biased ? biased - 1075 : -1074;
    bool even = (f & 1) == 0;
    bool boundary = f == (UINT64_C(1) << 52) && biased > 1;

    big r, s, plus, minus;
    if (e >= 0) {
        big_set(&r, f); big_shift_left(&r, (unsigned)e + (boundary ? 2 : 1));
        big_set(&s, boundary ? 4 : 2);
        big_set(&plus, 1); big_shift_left(&plus, (unsigned)e + (boundary ? 1 : 0));
        big_set(&minus, 1); big_shift_left(&minus, (unsigned)e);
    } else {
        big_set(&r, f); big_shift_left(&r, boundary ? 2 : 1);
        big_set(&s, 1); big_shift_left(&s, (unsigned)(-e) + (boundary ? 2 : 1));
        big_set(&plus, boundary ? 2 : 1);
        big_set(&minus, 1);
    }

    int k = (int)ceil(log10(number) - 1e-10);
    if (k >= 0) big_mul_pow10(&s, (unsigned)k);
    else {
        big_mul_pow10(&r, (unsigned)-k);
        big_mul_pow10(&plus, (unsigned)-k);
        big_mul_pow10(&minus, (unsigned)-k);
    }
    /* The high end of the interval must be below 1 (or at most 1 when it rounds to this double). */
    for (;;) {
        int high = big_sum_compare(&r, &plus, &s);
        if (even ? high < 0 : high <= 0) break;
        big_mul_small(&s, 10);
        k++;
        if (s.overflow) return false;
    }
    /* ... and at least 1/10. */
    for (;;) {
        big scaled;
        big_add(&r, &plus, &scaled);
        big_mul_small(&scaled, 10);
        int high = big_compare(&scaled, &s);
        if (even ? high >= 0 : high > 0) break;
        big_mul_small(&r, 10); big_mul_small(&plus, 10); big_mul_small(&minus, 10);
        k--;
        if (r.overflow || plus.overflow || minus.overflow) return false;
    }

    *count = 0;
    for (;;) {
        if (*count == 24) return false;
        big_mul_small(&r, 10); big_mul_small(&plus, 10); big_mul_small(&minus, 10);
        if (r.overflow || plus.overflow || minus.overflow) return false;
        int digit = 0;
        while (big_compare(&r, &s) >= 0) { big_subtract(&r, &s); digit++; }
        int low_compare = big_compare(&r, &minus);
        int high_compare = big_sum_compare(&r, &plus, &s);
        bool low = even ? low_compare <= 0 : low_compare < 0;
        bool high = even ? high_compare >= 0 : high_compare > 0;
        if (!low && !high) { digits[(*count)++] = (char)('0' + digit); continue; }
        if (low && high) {
            big twice = r;
            big_mul_small(&twice, 2);
            int half = big_compare(&twice, &s);
            if (half > 0 || (half == 0 && digit % 2)) digit++;
        } else if (high) {
            digit++;
        }
        if (digit > 9) return false;
        digits[(*count)++] = (char)('0' + digit);
        break;
    }
    *exponent = k;
    return true;
}

static bool append_exponent(ps_html_buffer *out, int exponent)
{
    char text[16];
    snprintf(text, sizeof(text), "e%c%d", exponent < 0 ? '-' : '+', exponent < 0 ? -exponent : exponent);
    return ps_html_text(out, text);
}

ps_chars ps_number_text(double number)
{
    if (!isfinite(number)) return (ps_chars){NULL, 0};
    if (number == 0) return ps_copy(PS_TEXT("0"));
    ps_html_buffer out = {0};
    if (number < 0) { ps_html_character(&out, '-'); number = -number; }
    char digits[32];
    size_t k = 0;
    int n = 0;
    if (!shortest_digits(number, digits, &k, &n)) { free(out.data); return (ps_chars){NULL, 0}; }
    ps_text all = {digits, k};
    if ((int)k <= n && n <= 21) {
        ps_html_append(&out, all);
        for (int i = (int)k; i < n; ++i) ps_html_character(&out, '0');
    } else if (0 < n && n <= 21) {
        ps_html_append(&out, ps_text_slice(all, 0, (size_t)n));
        ps_html_character(&out, '.');
        ps_html_append(&out, ps_text_slice(all, (size_t)n, k));
    } else if (-6 < n && n <= 0) {
        ps_html_text(&out, "0.");
        for (int i = n; i < 0; ++i) ps_html_character(&out, '0');
        ps_html_append(&out, all);
    } else {
        ps_html_character(&out, digits[0]);
        if (k > 1) {
            ps_html_character(&out, '.');
            ps_html_append(&out, ps_text_slice(all, 1, k));
        }
        append_exponent(&out, n - 1);
    }
    return ps_html_take(&out);
}

int ps_canonical_text(const ps_value *value, ps_chars *text)
{
    *text = (ps_chars){NULL, 0};
    if (!value) return 0;
    switch (value->kind) {
        case PS_STRING: *text = ps_copy(ps_string(value)); break;
        case PS_BOOL: *text = ps_copy(value->data.boolean ? PS_TEXT("1") : PS_TEXT("0")); break;
        /* An integer is written as its nearest double. */
        case PS_INT: *text = ps_number_text((double)value->data.integer); break;
        case PS_FLOAT: *text = ps_number_text(value->data.number); break;
        default: return 0;
    }
    return text->bytes ? 1 : -1;
}
