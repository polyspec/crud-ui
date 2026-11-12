#ifndef CRUDUI_BIGNUM_INTERNAL_H
#define CRUDUI_BIGNUM_INTERNAL_H

#include <stdbool.h>
#include <stddef.h>
#include <stdint.h>

/*
 * The word arithmetic of the exact decimal conversions (canonical.c and number_text.c): little-endian
 * 32-bit words, of which the first used are significant.
 */

/* Compare two numbers of used words: -1, 0 or 1. */
static inline int bignum_compare(const uint32_t *left, size_t left_used, const uint32_t *right, size_t right_used)
{
    if (left_used != right_used) return left_used < right_used ? -1 : 1;
    for (size_t i = left_used; i-- > 0;)
        if (left[i] != right[i]) return left[i] < right[i] ? -1 : 1;
    return 0;
}

/*
 * value = value * factor + addend over the used words. A carry that does not fit the capacity is
 * not written, and the result is false; the caller decides what that overflow means.
 */
static inline bool bignum_mul_add(uint32_t *words, size_t *used, size_t capacity, uint32_t factor, uint32_t addend)
{
    uint64_t carry = addend;
    for (size_t i = 0; i < *used; ++i) {
        uint64_t product = (uint64_t)words[i] * factor + carry;
        words[i] = (uint32_t)product;
        carry = product >> 32;
    }
    if (!carry) return true;
    if (*used >= capacity) return false;
    words[(*used)++] = (uint32_t)carry;
    return true;
}

#endif
