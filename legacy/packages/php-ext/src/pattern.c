#include "pattern_internal.h"

#include <stdio.h>
#include <stdlib.h>
#include <string.h>

/*
 * The CRUDUI pattern language (docs/spec/validation-rules.md, "Patterns" and "Parameter
 * errors"). The recognizer reads the declared pattern as code points from left to right and
 * reports the first construct outside the language with its reason and code-point offset; a
 * valid pattern becomes a syntax tree whose atoms are code-point sets. The size limit is checked
 * after the whole pattern is otherwise valid. Groups nest at most PATTERN_DEPTH_LIMIT deep, which
 * bounds the recursion of the parser.
 */

typedef struct {
    size_t start;
    size_t length;
} group_name;

typedef struct {
    uint32_t *points;
    size_t count;
    size_t position;
    pattern_tree *tree;
    group_name *names;
    size_t name_count;
    const char *reason;
    size_t offset;
    bool no_memory;
} pattern_parser;

/* A class member or escape: one code point, or a set of code points. */
typedef struct {
    bool single;
    uint32_t point;
    ps_code_set set;
} pattern_member;

static const ps_code_range digit_ranges[] = {{'0', '9'}};
static const ps_code_range word_ranges[] = {{'0', '9'}, {'A', 'Z'}, {'_', '_'}, {'a', 'z'}};
static const ps_code_range newline_ranges[] = {{0x0a, 0x0a}};

static bool fail(pattern_parser *parser, const char *reason, size_t offset)
{
    parser->reason = reason;
    parser->offset = offset;
    return false;
}

static bool out_of_memory(pattern_parser *parser)
{
    parser->no_memory = true;
    return false;
}

static bool at(const pattern_parser *parser, size_t index, uint32_t point)
{
    return index < parser->count && parser->points[index] == point;
}

static bool quantifier_start(const pattern_parser *parser, size_t index)
{
    return at(parser, index, '*') || at(parser, index, '+') || at(parser, index, '?') || at(parser, index, '{');
}

/* Engine strings are valid UTF-8 and never hold one; a literal must be a scalar value. */
static bool surrogate(uint32_t point)
{
    return point >= 0xd800 && point <= 0xdfff;
}

static int hex_value(uint32_t point)
{
    if (point >= '0' && point <= '9') return (int)(point - '0');
    if (point >= 'a' && point <= 'f') return (int)(point - 'a' + 10);
    if (point >= 'A' && point <= 'F') return (int)(point - 'A' + 10);
    return -1;
}

static bool name_start(uint32_t point)
{
    return (point >= 'A' && point <= 'Z') || (point >= 'a' && point <= 'z') || point == '_';
}

static bool name_part(uint32_t point)
{
    return name_start(point) || (point >= '0' && point <= '9');
}

static size_t new_node(pattern_parser *parser, uint8_t kind)
{
    pattern_tree *tree = parser->tree;
    if (tree->node_count == tree->node_capacity) {
        size_t capacity = tree->node_capacity ? tree->node_capacity * 2 : 16;
        pattern_node *nodes = realloc(tree->nodes, capacity * sizeof(*nodes));
        if (!nodes) { parser->no_memory = true; return PATTERN_NONE; }
        tree->nodes = nodes;
        tree->node_capacity = capacity;
    }
    tree->nodes[tree->node_count] = (pattern_node){
        .kind = kind, .set = PATTERN_NONE, .first = PATTERN_NONE, .next = PATTERN_NONE,
    };
    return tree->node_count++;
}

/* A set node that takes the set. */
static size_t set_node(pattern_parser *parser, ps_code_set *set)
{
    pattern_tree *tree = parser->tree;
    if (set->failed || !ps_code_set_normalize(set)) { ps_code_set_free(set); parser->no_memory = true; return PATTERN_NONE; }
    if (tree->set_count == tree->set_capacity) {
        size_t capacity = tree->set_capacity ? tree->set_capacity * 2 : 8;
        ps_code_set *sets = realloc(tree->sets, capacity * sizeof(*sets));
        if (!sets) { ps_code_set_free(set); parser->no_memory = true; return PATTERN_NONE; }
        tree->sets = sets;
        tree->set_capacity = capacity;
    }
    size_t index = tree->set_count++;
    tree->sets[index] = *set;
    *set = (ps_code_set){0};
    size_t node = new_node(parser, PATTERN_SET);
    if (node != PATTERN_NONE) tree->nodes[node].set = index;
    return node;
}

static void append_child(pattern_parser *parser, size_t parent, size_t child, size_t *last)
{
    pattern_node *nodes = parser->tree->nodes;
    if (*last == PATTERN_NONE) nodes[parent].first = child;
    else nodes[*last].next = child;
    *last = child;
}

/* \p{...} or \P{...} at the backslash: a general category or Script=Name, added to set. */
static bool parse_property(pattern_parser *parser, size_t backslash, ps_code_set *set)
{
    bool negated = parser->points[backslash + 1] == 'P';
    size_t open = backslash + 2;
    if (!at(parser, open, '{')) return fail(parser, "invalid property", backslash);
    size_t close = open + 1;
    while (close < parser->count && parser->points[close] != '}') close++;
    if (close == parser->count) return fail(parser, "invalid property", backslash);
    char name[64];
    size_t length = close - open - 1;
    if (length >= sizeof(name)) return fail(parser, "invalid property", backslash);
    for (size_t i = 0; i < length; ++i) {
        uint32_t point = parser->points[open + 1 + i];
        if (point == 0 || point > 0x7e) return fail(parser, "invalid property", backslash);
        name[i] = (char)point;
    }
    ps_text text = {name, length};
    static const char script_prefix[] = "Script=";
    const ps_unicode_property *property = ps_text_starts(text, script_prefix)
        ? ps_unicode_script(ps_text_slice(text, sizeof(script_prefix) - 1, length))
        : ps_unicode_category(text);
    if (!property) return fail(parser, "invalid property", backslash);
    ps_code_set ranges = {0};
    ps_code_set_add_ranges(&ranges, property->ranges, property->count);
    if (negated) ps_code_set_complement(&ranges);
    if (ranges.failed || !ps_code_set_add_ranges(set, ranges.ranges, ranges.count)) {
        ps_code_set_free(&ranges);
        return out_of_memory(parser);
    }
    ps_code_set_free(&ranges);
    parser->position = close + 1;
    return true;
}

/*
 * An escape at the backslash. class_start is the [ of the enclosing class, or PATTERN_NONE
 * outside a class. Literal and character escapes give one code point; shorthands and properties
 * give a set.
 */
static bool parse_escape(pattern_parser *parser, size_t class_start, pattern_member *member)
{
    size_t backslash = parser->position;
    *member = (pattern_member){0};
    if (backslash + 1 >= parser->count) return fail(parser, "invalid escape", backslash);
    uint32_t kind = parser->points[backslash + 1];
    if (kind < 0x80 && kind && strchr("^$\\.*+?()[]{}|/-", (int)kind)) {
        *member = (pattern_member){.single = true, .point = kind};
        parser->position = backslash + 2;
        return true;
    }
    static const struct { char name; uint32_t point; } controls[] = {
        {'t', 0x09}, {'n', 0x0a}, {'r', 0x0d}, {'f', 0x0c}, {'v', 0x0b},
    };
    for (size_t i = 0; i < sizeof(controls) / sizeof(controls[0]); ++i) {
        if (kind != (uint32_t)controls[i].name) continue;
        *member = (pattern_member){.single = true, .point = controls[i].point};
        parser->position = backslash + 2;
        return true;
    }
    if (kind == 'x') {
        int high = backslash + 2 < parser->count ? hex_value(parser->points[backslash + 2]) : -1;
        int low = backslash + 3 < parser->count ? hex_value(parser->points[backslash + 3]) : -1;
        if (high < 0 || low < 0) return fail(parser, "invalid escape", backslash);
        *member = (pattern_member){.single = true, .point = (uint32_t)(high * 16 + low)};
        parser->position = backslash + 4;
        return true;
    }
    if (kind == 'u') {
        size_t index = backslash + 2;
        if (!at(parser, index, '{')) return fail(parser, "invalid escape", backslash);
        uint32_t value = 0;
        size_t digits = 0;
        for (index++; index < parser->count && hex_value(parser->points[index]) >= 0; ++index) {
            if (++digits > 6) return fail(parser, "invalid escape", backslash);
            value = value * 16 + (uint32_t)hex_value(parser->points[index]);
        }
        if (!digits || !at(parser, index, '}') || value > 0x10ffff || surrogate(value))
            return fail(parser, "invalid escape", backslash);
        *member = (pattern_member){.single = true, .point = value};
        parser->position = index + 1;
        return true;
    }
    if (kind == 'p' || kind == 'P') return parse_property(parser, backslash, &member->set);
    bool complement = kind == 'D' || kind == 'W' || kind == 'S';
    switch (kind) {
        case 'd': case 'D': ps_code_set_add_ranges(&member->set, digit_ranges, 1); break;
        case 'w': case 'W': ps_code_set_add_ranges(&member->set, word_ranges, 4); break;
        case 's': case 'S': ps_code_set_add_ranges(&member->set, ps_white_space, ps_white_space_count); break;
        default: return fail(parser, "invalid escape", backslash);
    }
    if (complement && class_start != PATTERN_NONE) {
        ps_code_set_free(&member->set);
        return fail(parser, "invalid class", class_start);
    }
    if (complement) ps_code_set_complement(&member->set);
    if (member->set.failed) return out_of_memory(parser);
    parser->position = backslash + 2;
    return true;
}

/*
 * One class member at the current position, which is before the closing ]. first is the
 * position of the first member.
 */
static bool parse_class_member(pattern_parser *parser, size_t class_start, size_t first, pattern_member *member)
{
    size_t position = parser->position;
    uint32_t point = parser->points[position];
    *member = (pattern_member){0};
    if (point == '[') return fail(parser, "invalid class", class_start);
    if (point == '\\') return parse_escape(parser, class_start, member);
    if (point == '-' && position != first && position + 1 != parser->count && !at(parser, position + 1, ']'))
        return fail(parser, "invalid class", class_start);
    if (surrogate(point)) return fail(parser, "unexpected character", position);
    *member = (pattern_member){.single = true, .point = point};
    parser->position++;
    return true;
}

static bool add_member(pattern_parser *parser, ps_code_set *set, const pattern_member *member)
{
    bool added = member->single
        ? ps_code_set_add(set, member->point, member->point)
        : ps_code_set_add_ranges(set, member->set.ranges, member->set.count);
    return added || out_of_memory(parser);
}

static size_t parse_class(pattern_parser *parser)
{
    size_t class_start = parser->position++;
    bool negated = at(parser, parser->position, '^');
    if (negated) parser->position++;
    size_t first = parser->position;
    ps_code_set set = {0};
    for (;;) {
        if (parser->position == parser->count) { fail(parser, "unterminated class", parser->count); break; }
        if (parser->points[parser->position] == ']') {
            if (parser->position == first) { fail(parser, "invalid class", class_start); break; }
            parser->position++;
            if (negated) ps_code_set_complement(&set);
            return set_node(parser, &set);
        }
        size_t member_start = parser->position;
        pattern_member left, right;
        if (!parse_class_member(parser, class_start, first, &left)) { ps_code_set_free(&left.set); break; }
        bool range = at(parser, parser->position, '-') && parser->position + 1 != parser->count &&
            !at(parser, parser->position + 1, ']');
        if (!range) {
            bool added = add_member(parser, &set, &left);
            ps_code_set_free(&left.set);
            if (!added) break;
            continue;
        }
        parser->position++;
        bool read = parse_class_member(parser, class_start, first, &right);
        bool valid = read && left.single && right.single && left.point <= right.point;
        if (read && !valid) fail(parser, "invalid range", member_start);
        ps_code_set_free(&left.set);
        ps_code_set_free(&right.set);
        if (!valid) break;
        if (!ps_code_set_add(&set, left.point, right.point)) { out_of_memory(parser); break; }
    }
    ps_code_set_free(&set);
    return PATTERN_NONE;
}

/* The bound of one decimal number of a {…} quantifier, saturated above the limit. */
static bool parse_bound(pattern_parser *parser, uint32_t *value)
{
    size_t start = parser->position;
    *value = 0;
    while (parser->position < parser->count && parser->points[parser->position] >= '0' &&
           parser->points[parser->position] <= '9') {
        uint32_t digit = parser->points[parser->position] - '0';
        *value = *value > PATTERN_BOUND_LIMIT ? *value : *value * 10 + digit;
        parser->position++;
    }
    return parser->position > start;
}

/* The optional quantifier after an item; the result is the item or its repeat node. */
static size_t parse_quantifier(pattern_parser *parser, size_t item)
{
    if (!quantifier_start(parser, parser->position)) return item;
    size_t start = parser->position;
    uint32_t kind = parser->points[start];
    uint32_t minimum = 0, maximum = 0;
    bool unbounded = false;
    parser->position++;
    if (kind == '{') {
        if (!parse_bound(parser, &minimum)) { fail(parser, "invalid quantifier", start); return PATTERN_NONE; }
        if (at(parser, parser->position, ',')) {
            parser->position++;
            if (at(parser, parser->position, '}')) unbounded = true;
            else if (!parse_bound(parser, &maximum)) { fail(parser, "invalid quantifier", start); return PATTERN_NONE; }
        } else {
            maximum = minimum;
        }
        if (!at(parser, parser->position, '}') || minimum > PATTERN_BOUND_LIMIT ||
            (!unbounded && (maximum > PATTERN_BOUND_LIMIT || minimum > maximum))) {
            fail(parser, "invalid quantifier", start);
            return PATTERN_NONE;
        }
        parser->position++;
    } else {
        minimum = kind == '+' ? 1 : 0;
        maximum = 1;
        unbounded = kind != '?';
    }
    if (at(parser, parser->position, '?')) parser->position++;
    if (quantifier_start(parser, parser->position)) {
        fail(parser, "invalid quantifier", parser->position);
        return PATTERN_NONE;
    }
    size_t node = new_node(parser, PATTERN_REPEAT);
    if (node == PATTERN_NONE) return PATTERN_NONE;
    pattern_node *repeat = &parser->tree->nodes[node];
    repeat->first = item;
    repeat->minimum = minimum;
    repeat->maximum = unbounded ? 0 : maximum;
    repeat->unbounded = unbounded;
    return node;
}

static bool same_name(const pattern_parser *parser, group_name left, group_name right)
{
    return left.length == right.length &&
        !memcmp(parser->points + left.start, parser->points + right.start, left.length * sizeof(uint32_t));
}

/* The opening of a group at the current position, up to its body. */
static bool parse_group_open(pattern_parser *parser)
{
    size_t open = parser->position;
    size_t body = open + 1;
    if (at(parser, open + 1, '?')) {
        if (at(parser, open + 2, ':')) {
            body = open + 3;
        } else if (at(parser, open + 2, '<')) {
            if (at(parser, open + 3, '=') || at(parser, open + 3, '!'))
                return fail(parser, "unsupported construct", open);
            group_name name = {open + 3, 0};
            size_t end = name.start;
            while (end < parser->count && name_part(parser->points[end])) end++;
            name.length = end - name.start;
            if (!name.length || !name_start(parser->points[name.start]) || !at(parser, end, '>'))
                return fail(parser, "invalid group name", open);
            for (size_t i = 0; i < parser->name_count; ++i)
                if (same_name(parser, parser->names[i], name)) return fail(parser, "duplicate group name", open);
            group_name *names = realloc(parser->names, (parser->name_count + 1) * sizeof(*names));
            if (!names) return out_of_memory(parser);
            parser->names = names;
            parser->names[parser->name_count++] = name;
            body = end + 1;
        } else {
            return fail(parser, "unsupported construct", open);
        }
    }
    parser->position = body;
    return true;
}

static size_t parse_choice(pattern_parser *parser, unsigned depth);

/* One atom, group or anchor. *anchor is set for an anchor, which takes no quantifier. */
static size_t parse_atom(pattern_parser *parser, unsigned depth, bool *anchor)
{
    size_t start = parser->position;
    uint32_t point = parser->points[start];
    *anchor = false;
    switch (point) {
        case '(': {
            if (depth >= PATTERN_DEPTH_LIMIT) { fail(parser, "nesting too deep", start); return PATTERN_NONE; }
            if (!parse_group_open(parser)) return PATTERN_NONE;
            size_t choice = parse_choice(parser, depth + 1);
            if (choice == PATTERN_NONE) return PATTERN_NONE;
            if (!at(parser, parser->position, ')')) { fail(parser, "unterminated group", parser->count); return PATTERN_NONE; }
            parser->position++;
            return choice;
        }
        case '[':
            return parse_class(parser);
        case '\\': {
            pattern_member member;
            if (!parse_escape(parser, PATTERN_NONE, &member)) { ps_code_set_free(&member.set); return PATTERN_NONE; }
            if (member.single && !ps_code_set_add(&member.set, member.point, member.point)) {
                out_of_memory(parser);
                ps_code_set_free(&member.set);
                return PATTERN_NONE;
            }
            return set_node(parser, &member.set);
        }
        case '.': {
            parser->position++;
            ps_code_set set = {0};
            ps_code_set_add_ranges(&set, newline_ranges, 1);
            ps_code_set_complement(&set);
            return set_node(parser, &set);
        }
        case '^': case '$':
            if (start != (point == '^' ? 0 : parser->count - 1)) {
                fail(parser, "unexpected character", start);
                return PATTERN_NONE;
            }
            parser->position++;
            *anchor = true;
            return new_node(parser, PATTERN_EMPTY);
        case ']': case '}':
            fail(parser, "unexpected character", start);
            return PATTERN_NONE;
        case '*': case '+': case '?': case '{':
            fail(parser, "invalid quantifier", start);
            return PATTERN_NONE;
        default: {
            if (surrogate(point)) { fail(parser, "unexpected character", start); return PATTERN_NONE; }
            parser->position++;
            ps_code_set set = {0};
            ps_code_set_add(&set, point, point);
            return set_node(parser, &set);
        }
    }
}

static size_t parse_sequence(pattern_parser *parser, unsigned depth)
{
    size_t sequence = new_node(parser, PATTERN_SEQUENCE);
    if (sequence == PATTERN_NONE) return PATTERN_NONE;
    size_t last = PATTERN_NONE;
    while (parser->position < parser->count && !at(parser, parser->position, '|') &&
           !at(parser, parser->position, ')')) {
        bool anchor;
        size_t item = parse_atom(parser, depth, &anchor);
        if (item == PATTERN_NONE) return PATTERN_NONE;
        if (anchor && quantifier_start(parser, parser->position)) {
            fail(parser, "invalid quantifier", parser->position);
            return PATTERN_NONE;
        }
        if (!anchor) item = parse_quantifier(parser, item);
        if (item == PATTERN_NONE) return PATTERN_NONE;
        append_child(parser, sequence, item, &last);
    }
    return sequence;
}

static size_t parse_choice(pattern_parser *parser, unsigned depth)
{
    size_t choice = new_node(parser, PATTERN_CHOICE);
    if (choice == PATTERN_NONE) return PATTERN_NONE;
    size_t last = PATTERN_NONE;
    for (;;) {
        size_t sequence = parse_sequence(parser, depth);
        if (sequence == PATTERN_NONE) return PATTERN_NONE;
        append_child(parser, choice, sequence, &last);
        if (!at(parser, parser->position, '|')) return choice;
        parser->position++;
    }
}

static uint32_t saturate(uint64_t size)
{
    return size > PATTERN_SIZE_LIMIT ? PATTERN_SIZE_LIMIT + 1 : (uint32_t)size;
}

/* The sizes of a subtree; the depth of the recursion is bounded by the group nesting limit. */
static uint32_t measure(pattern_tree *tree, size_t index)
{
    pattern_node *node = &tree->nodes[index];
    uint64_t size = 0;
    switch (node->kind) {
        case PATTERN_SET: size = 1; break;
        case PATTERN_EMPTY: size = 0; break;
        case PATTERN_REPEAT: {
            uint64_t item = measure(tree, node->first);
            size = item * (node->unbounded ? (uint64_t)node->minimum + 1 : node->maximum);
            break;
        }
        default:
            for (size_t child = node->first; child != PATTERN_NONE; child = tree->nodes[child].next)
                size += measure(tree, child);
            break;
    }
    tree->nodes[index].size = saturate(size);
    return tree->nodes[index].size;
}

/*
 * Unlink the children of size 0 from sequences and choices: they match only the empty text. A
 * choice that loses one becomes optional. Every node has one parent, so this is linear.
 */
static void prune(pattern_tree *tree)
{
    for (size_t index = 0; index < tree->node_count; ++index) {
        pattern_node *node = &tree->nodes[index];
        if (node->kind != PATTERN_SEQUENCE && node->kind != PATTERN_CHOICE) continue;
        size_t kept = PATTERN_NONE, last = PATTERN_NONE;
        for (size_t child = node->first; child != PATTERN_NONE;) {
            size_t next = tree->nodes[child].next;
            if (tree->nodes[child].size == 0) {
                if (node->kind == PATTERN_CHOICE) node->optional = true;
            } else {
                tree->nodes[child].next = PATTERN_NONE;
                if (last == PATTERN_NONE) kept = child;
                else tree->nodes[last].next = child;
                last = child;
            }
            child = next;
        }
        node->first = kept;
    }
}

void ps_pattern_tree_free(pattern_tree *tree)
{
    for (size_t i = 0; i < tree->set_count; ++i) ps_code_set_free(&tree->sets[i]);
    free(tree->sets);
    free(tree->nodes);
    *tree = (pattern_tree){0};
}

int ps_pattern_parse(ps_text source, pattern_tree *tree, ps_pattern_error *error)
{
    *tree = (pattern_tree){.root = PATTERN_NONE};
    *error = (ps_pattern_error){NULL, 0};
    pattern_parser parser = {.tree = tree};
    parser.points = malloc((source.length ? source.length : 1) * sizeof(uint32_t));
    if (!parser.points) return -1;
    for (size_t index = 0; index < source.length; parser.count++)
        index += ps_utf8_decode(source, index, &parser.points[parser.count]);
    bool valid = false;
    if (!parser.count) {
        fail(&parser, "empty pattern", 0);
    } else {
        tree->root = parse_choice(&parser, 0);
        if (tree->root != PATTERN_NONE && parser.position < parser.count)
            fail(&parser, "unexpected character", parser.position);
        else if (tree->root != PATTERN_NONE && measure(tree, tree->root) > PATTERN_SIZE_LIMIT)
            fail(&parser, "pattern too large", 0);
        else
            valid = tree->root != PATTERN_NONE;
    }
    free(parser.points);
    free(parser.names);
    if (parser.no_memory || !valid) {
        ps_pattern_tree_free(tree);
        if (parser.no_memory) return -1;
        *error = (ps_pattern_error){parser.reason, parser.offset};
        return 0;
    }
    prune(tree);
    return 1;
}
