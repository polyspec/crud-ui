#include "pattern_internal.h"

#include <stdlib.h>
#include <string.h>

/*
 * The linear-time matcher of CRUDUI patterns. A syntax tree compiles to a Thompson NFA whose
 * character states refer to the tree's code-point sets (every copy of an atom shares its set). A
 * bounded repetition copies its item: the required copies, then the optional copies; an unbounded
 * one ends with one loop. Items of size 0 were pruned or compile to one epsilon state, so the
 * number of character states is at most the pattern size. The match advances the set of active
 * states over the code points of the text with generation marks and an explicit stack, so its time
 * is proportional to the text length times the states and its memory to the states.
 */

enum {
    STATE_CHARACTER,
    STATE_SPLIT,
    STATE_EPSILON,
    STATE_MATCH
};

#define STATE_NONE UINT32_MAX

typedef struct {
    uint8_t kind;
    uint32_t set;
    uint32_t out;
    uint32_t alternative;
} nfa_state;

struct ps_pattern {
    nfa_state *states;
    size_t state_count;
    uint32_t start;
    ps_code_set *sets;
    size_t set_count;
};

typedef struct {
    const pattern_tree *tree;
    nfa_state *states;
    size_t count;
    size_t capacity;
    bool failed;
} nfa_builder;

static uint32_t add_state(nfa_builder *builder, uint8_t kind, uint32_t set, uint32_t out, uint32_t alternative)
{
    if (builder->failed) return STATE_NONE;
    if (builder->count == builder->capacity) {
        size_t capacity = builder->capacity ? builder->capacity * 2 : 32;
        nfa_state *states = capacity < STATE_NONE ? realloc(builder->states, capacity * sizeof(*states)) : NULL;
        if (!states) { builder->failed = true; return STATE_NONE; }
        builder->states = states;
        builder->capacity = capacity;
    }
    builder->states[builder->count] = (nfa_state){kind, set, out, alternative};
    return (uint32_t)builder->count++;
}

/* The start state of a node followed by next; the recursion follows the group nesting. */
static uint32_t compile_node(nfa_builder *builder, size_t index, uint32_t next)
{
    const pattern_node *node = &builder->tree->nodes[index];
    if (builder->failed) return STATE_NONE;
    if (node->size == 0) return add_state(builder, STATE_EPSILON, 0, next, STATE_NONE);
    switch (node->kind) {
        case PATTERN_SET:
            return add_state(builder, STATE_CHARACTER, (uint32_t)node->set, next, STATE_NONE);
        case PATTERN_SEQUENCE: {
            /* Children are compiled from the last; a sequence has at most size children. */
            size_t count = 0;
            for (size_t child = node->first; child != PATTERN_NONE; child = builder->tree->nodes[child].next) count++;
            size_t *children = malloc(count * sizeof(*children));
            if (!children) { builder->failed = true; return STATE_NONE; }
            count = 0;
            for (size_t child = node->first; child != PATTERN_NONE; child = builder->tree->nodes[child].next)
                children[count++] = child;
            while (count > 0) next = compile_node(builder, children[--count], next);
            free(children);
            return next;
        }
        case PATTERN_CHOICE: {
            uint32_t start = node->optional ? next : STATE_NONE;
            for (size_t child = node->first; child != PATTERN_NONE; child = builder->tree->nodes[child].next) {
                uint32_t branch = compile_node(builder, child, next);
                start = start == STATE_NONE ? branch : add_state(builder, STATE_SPLIT, 0, branch, start);
            }
            return start;
        }
        case PATTERN_REPEAT: {
            uint32_t tail = next;
            if (node->unbounded) {
                uint32_t loop = add_state(builder, STATE_SPLIT, 0, STATE_NONE, next);
                uint32_t body = compile_node(builder, node->first, loop);
                if (builder->failed) return STATE_NONE;
                builder->states[loop].out = body;
                tail = loop;
            } else {
                for (uint32_t i = node->minimum; i < node->maximum; ++i) {
                    uint32_t body = compile_node(builder, node->first, tail);
                    tail = add_state(builder, STATE_SPLIT, 0, body, next);
                }
            }
            for (uint32_t i = 0; i < node->minimum; ++i) tail = compile_node(builder, node->first, tail);
            return tail;
        }
        default:
            return add_state(builder, STATE_EPSILON, 0, next, STATE_NONE);
    }
}

int ps_pattern_compile(ps_text source, ps_pattern **pattern, ps_pattern_error *error)
{
    *pattern = NULL;
    pattern_tree tree;
    int parsed = ps_pattern_parse(source, &tree, error);
    if (parsed <= 0) return parsed;
    nfa_builder builder = {.tree = &tree};
    uint32_t match = add_state(&builder, STATE_MATCH, 0, STATE_NONE, STATE_NONE);
    uint32_t start = compile_node(&builder, tree.root, match);
    ps_pattern *compiled = builder.failed ? NULL : malloc(sizeof(*compiled));
    if (!compiled) {
        free(builder.states);
        ps_pattern_tree_free(&tree);
        return -1;
    }
    *compiled = (ps_pattern){builder.states, builder.count, start, tree.sets, tree.set_count};
    tree.sets = NULL;
    tree.set_count = 0;
    ps_pattern_tree_free(&tree);
    *pattern = compiled;
    return 1;
}

size_t ps_pattern_state_count(const ps_pattern *pattern)
{
    return pattern->state_count;
}

void ps_pattern_free(ps_pattern *pattern)
{
    if (!pattern) return;
    for (size_t i = 0; i < pattern->set_count; ++i) ps_code_set_free(&pattern->sets[i]);
    free(pattern->sets);
    free(pattern->states);
    free(pattern);
}

typedef struct {
    const ps_pattern *pattern;
    uint64_t *marks;
    uint32_t *stack;
    uint64_t generation;
} state_walk;

/*
 * Add the epsilon closure of a state to a list: its character and match states. A state enters
 * the list once per generation; the stack holds at most one entry per edge.
 */
static void add_closure(state_walk *walk, uint32_t state, uint32_t *list, size_t *count)
{
    size_t depth = 0;
    walk->stack[depth++] = state;
    while (depth > 0) {
        uint32_t current = walk->stack[--depth];
        if (walk->marks[current] == walk->generation) continue;
        walk->marks[current] = walk->generation;
        const nfa_state *item = &walk->pattern->states[current];
        switch (item->kind) {
            case STATE_SPLIT:
                walk->stack[depth++] = item->alternative;
                walk->stack[depth++] = item->out;
                break;
            case STATE_EPSILON:
                walk->stack[depth++] = item->out;
                break;
            default:
                list[(*count)++] = current;
                break;
        }
    }
}

int ps_pattern_matches(const ps_pattern *pattern, ps_text text)
{
    size_t states = pattern->state_count;
    uint32_t *current = malloc(states * sizeof(*current));
    uint32_t *next = malloc(states * sizeof(*next));
    uint32_t *stack = malloc((2 * states + 1) * sizeof(*stack));
    uint64_t *marks = calloc(states, sizeof(*marks));
    uint64_t *set_generation = calloc(pattern->set_count ? pattern->set_count : 1, sizeof(*set_generation));
    bool *set_member = malloc((pattern->set_count ? pattern->set_count : 1) * sizeof(*set_member));
    int result = -1;
    if (!current || !next || !stack || !marks || !set_generation || !set_member) goto done;

    state_walk walk = {pattern, marks, stack, 1};
    size_t count = 0;
    add_closure(&walk, pattern->start, current, &count);
    for (size_t index = 0; index < text.length && count > 0;) {
        uint32_t code_point;
        index += ps_utf8_decode(text, index, &code_point);
        walk.generation++;
        size_t next_count = 0;
        for (size_t i = 0; i < count; ++i) {
            const nfa_state *state = &pattern->states[current[i]];
            if (state->kind != STATE_CHARACTER) continue;
            /* Membership is decided once per set in each step. */
            if (set_generation[state->set] != walk.generation) {
                const ps_code_set *set = &pattern->sets[state->set];
                set_generation[state->set] = walk.generation;
                set_member[state->set] = ps_code_ranges_contain(set->ranges, set->count, code_point);
            }
            if (set_member[state->set]) add_closure(&walk, state->out, next, &next_count);
        }
        uint32_t *swap = current;
        current = next;
        next = swap;
        count = next_count;
    }
    result = 0;
    for (size_t i = 0; i < count; ++i)
        if (pattern->states[current[i]].kind == STATE_MATCH) result = 1;
done:
    free(current);
    free(next);
    free(stack);
    free(marks);
    free(set_generation);
    free(set_member);
    return result;
}

typedef struct {
    ps_chars source;
    ps_pattern *pattern;
    ps_pattern_error error;
} cache_entry;

struct ps_pattern_cache {
    cache_entry *entries;
    size_t count;
    size_t capacity;
};

ps_pattern_cache *ps_pattern_cache_new(void)
{
    return calloc(1, sizeof(ps_pattern_cache));
}

int ps_pattern_cache_get(ps_pattern_cache *cache, ps_text source, const ps_pattern **pattern,
                         ps_pattern_error *error)
{
    *pattern = NULL;
    for (size_t i = 0; i < cache->count; ++i) {
        cache_entry *entry = &cache->entries[i];
        if (!ps_text_equal(ps_view(entry->source), source)) continue;
        *pattern = entry->pattern;
        *error = entry->error;
        return entry->pattern ? 1 : 0;
    }
    if (cache->count == cache->capacity) {
        size_t capacity = cache->capacity ? cache->capacity * 2 : 8;
        cache_entry *entries = realloc(cache->entries, capacity * sizeof(*entries));
        if (!entries) return -1;
        cache->entries = entries;
        cache->capacity = capacity;
    }
    cache_entry entry = {ps_copy(source), NULL, {NULL, 0}};
    if (!entry.source.bytes) return -1;
    int compiled = ps_pattern_compile(source, &entry.pattern, &entry.error);
    if (compiled < 0) { free(entry.source.bytes); return -1; }
    cache->entries[cache->count++] = entry;
    *pattern = entry.pattern;
    *error = entry.error;
    return compiled;
}

void ps_pattern_cache_free(ps_pattern_cache *cache)
{
    if (!cache) return;
    for (size_t i = 0; i < cache->count; ++i) {
        free(cache->entries[i].source.bytes);
        ps_pattern_free(cache->entries[i].pattern);
    }
    free(cache->entries);
    free(cache);
}
