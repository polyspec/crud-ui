#include "engine_internal.h"

#include <errno.h>
#include <stdint.h>
#include <stdio.h>
#include <string.h>

#ifdef __APPLE__
#include <stdlib.h>
#else
#include <sys/random.h>
#endif

static ps_result invalid_sequence(void)
{
    return ps_fail("form", "INVALID_FORM_INPUT",
                   "A sequence must contain 1–13 decimal digits", "");
}

ps_result ps_sequence_key(const ps_value *sequence)
{
    char digits[14];
    size_t length = 0;
    if (sequence && sequence->kind == PS_INT) {
        if (sequence->data.integer < 0 || sequence->data.integer > INT64_C(9999999999999))
            return invalid_sequence();
        int written = snprintf(digits, sizeof(digits), "%lld",
                               (long long)sequence->data.integer);
        if (written < 1 || written > 13) return invalid_sequence();
        length = (size_t)written;
    } else if (sequence && sequence->kind == PS_STRING) {
        length = sequence->data.string.length;
        if (length < 1 || length > 13) return invalid_sequence();
        for (size_t i = 0; i < length; ++i) {
            char character = sequence->data.string.bytes[i];
            if (character < '0' || character > '9') return invalid_sequence();
        }
        memcpy(digits, sequence->data.string.bytes, length);
        digits[length] = '\0';
    } else {
        return ps_fail("form", "INVALID_FORM_INPUT",
                       "A sequence must be an integer or decimal string", "");
    }

    char key[18] = "__0000000000000__";
    memcpy(key + 15 - length, digits, length);
    return ps_ok(ps_string_value(key));
}

static bool random_bytes(uint8_t *bytes, size_t length)
{
#ifdef __APPLE__
    arc4random_buf(bytes, length);
    return true;
#else
    size_t offset = 0;
    while (offset < length) {
        ssize_t count = getrandom(bytes + offset, length - offset, 0);
        if (count > 0) {
            offset += (size_t)count;
            continue;
        }
        if (count < 0 && errno == EINTR) continue;
        return false;
    }
    return true;
#endif
}

ps_result ps_create_key(void)
{
    uint8_t bytes[7];
    if (!random_bytes(bytes, sizeof(bytes)))
        return ps_fail("internal", "INTERNAL_ERROR", "Row key generation failed", "");
    static const char hex[] = "0123456789abcdef";
    char key[18] = "__0000000000000__";
    for (size_t i = 0; i < 13; ++i) {
        uint8_t byte = bytes[i / 2];
        key[i + 2] = hex[i % 2 ? byte & 0x0f : byte >> 4];
    }
    return ps_ok(ps_string_value(key));
}
