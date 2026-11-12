#ifndef CRUDUI_PATTERN_INTERNAL_H
#define CRUDUI_PATTERN_INTERNAL_H

#include "engine_internal.h"

/*
 * The syntax tree of a CRUDUI pattern (pattern.c), compiled by pattern_match.c. Groups are not
 * nodes: a group is its choice. Child lists are linked through next.
 */
#define PATTERN_NONE SIZE_MAX
#define PATTERN_SIZE_LIMIT 1000
#define PATTERN_DEPTH_LIMIT 100
#define PATTERN_BOUND_LIMIT 1000

enum {
    PATTERN_SET,      /* one code point of a set */
    PATTERN_EMPTY,    /* an anchor: matches the empty text */
    PATTERN_SEQUENCE, /* children in order */
    PATTERN_CHOICE,   /* one of the children */
    PATTERN_REPEAT    /* the first child from minimum to maximum times */
};

typedef struct {
    uint8_t kind;
    /* A choice with an alternative of size 0, which matches the empty text (set when pruned). */
    bool optional;
    bool unbounded;
    size_t set;
    size_t first;
    size_t next;
    uint32_t minimum;
    uint32_t maximum;
    /* The size of docs/spec/validation-rules.md, "Patterns", saturated above the limit. */
    uint32_t size;
} pattern_node;

typedef struct {
    pattern_node *nodes;
    size_t node_count;
    size_t node_capacity;
    ps_code_set *sets;
    size_t set_count;
    size_t set_capacity;
    size_t root;
} pattern_tree;

/* 1 with a valid tree whose size is within the limit, 0 with the error, -1 on allocation failure. */
int ps_pattern_parse(ps_text source, pattern_tree *tree, ps_pattern_error *error);
void ps_pattern_tree_free(pattern_tree *tree);

#endif
