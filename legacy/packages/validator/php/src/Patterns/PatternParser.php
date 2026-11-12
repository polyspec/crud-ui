<?php

declare(strict_types=1);

namespace Polyspec\Crudui\Validator\Patterns;

use Polyspec\Crudui\Validator\Values\CodePointSet;
use Polyspec\Crudui\Validator\Values\Utf8;

/**
 * Recognize the CRUDUI pattern language. A pattern outside the language raises a
 * PatternSyntaxError with the reason and the code point offset where the invalid
 * construct starts; a pattern inside it becomes a node tree without anchors.
 *
 * @internal
 */
final class PatternParser
{
    /** Largest quantifier bound. */
    public const MAXIMUM_BOUND = 1000;

    /** Largest pattern size. */
    public const MAXIMUM_SIZE = 1000;

    /** Deepest group nesting. */
    public const MAXIMUM_DEPTH = 100;

    /** Code points a `\` makes literal. */
    private const ESCAPABLE = '^$\\.*+?()[]{}|/-';

    /** Control escapes and their code points. */
    private const CONTROLS = ['t' => 0x09, 'n' => 0x0A, 'r' => 0x0D, 'f' => 0x0C, 'v' => 0x0B];

    /** Quantifier characters: * + ? { */
    private const QUANTIFIERS = [0x2A, 0x2B, 0x3F, 0x7B];

    /** @var list<int> */
    private readonly array $source;

    private readonly int $length;

    private int $position = 0;

    /** @var array<string, true> group names seen so far */
    private array $names = [];

    /** @param list<int> $source the pattern's code points */
    private function __construct(array $source)
    {
        $this->source = $source;
        $this->length = \count($source);
    }

    /**
     * Recognize a pattern.
     *
     * @throws PatternSyntaxError when the pattern is outside the language
     */
    public static function parse(string $pattern): Alternation
    {
        if ($pattern === '') {
            throw new PatternSyntaxError('empty pattern', 0);
        }
        $parser = new self(Utf8::decode($pattern, true));
        if ($parser->is(0, '^')) {
            $parser->position = 1;
        }
        $body = $parser->alternation(0);
        if ($body->size() > self::MAXIMUM_SIZE) {
            throw new PatternSyntaxError('pattern too large', 0);
        }
        return $body;
    }

    /** Cap a size just above the limit so nested products never overflow. */
    public static function capSize(int $size): int
    {
        return min($size, self::MAXIMUM_SIZE + 1);
    }

    /** Alternatives up to the end of the pattern or, inside a group of $depth ≥ 1, up to `)`. */
    private function alternation(int $depth): Alternation
    {
        $branches = [];
        $items = [];
        while (true) {
            if ($this->position >= $this->length) {
                if ($depth > 0) {
                    throw new PatternSyntaxError('unterminated group', $this->length);
                }
                break;
            }
            if ($this->is($this->position, '|')) {
                $branches[] = $items;
                $items = [];
                $this->position++;
                continue;
            }
            if ($this->is($this->position, ')')) {
                if ($depth > 0) {
                    break;
                }
                throw new PatternSyntaxError('unexpected character', $this->position);
            }
            $item = $this->item($depth);
            if ($item !== null) {
                $items[] = $this->quantified($item);
            }
        }
        $branches[] = $items;
        return new Alternation($branches);
    }

    /** One atom or group, or null for the closing `$` anchor. */
    private function item(int $depth): ?Node
    {
        $at = $this->position;
        $character = $this->source[$at];
        switch ($character) {
            case 0x28: // (
                return $this->group($depth + 1);
            case 0x5B: // [
                return new SetAtom($this->bracketClass());
            case 0x5C: // \
                return new SetAtom($this->escape());
            case 0x2E: // .
                $this->position++;
                return new SetAtom(PropertySets::any());
            case 0x2A: // *
            case 0x2B: // +
            case 0x3F: // ?
            case 0x7B: // {
                throw new PatternSyntaxError('invalid quantifier', $at);
            case 0x24: // $
                if ($at === $this->length - 1) {
                    $this->position++;
                    return null;
                }
                throw new PatternSyntaxError('unexpected character', $at);
            case 0x5E: // ^
            case 0x5D: // ]
            case 0x7D: // }
                throw new PatternSyntaxError('unexpected character', $at);
            default:
                $codePoint = $this->literal();
                return new SetAtom(CodePointSet::fromBounds([$codePoint, $codePoint]));
        }
    }

    /** A quantifier after an atom or group, if any. */
    private function quantified(Node $item): Node
    {
        if ($this->position >= $this->length) {
            return $item;
        }
        switch ($this->source[$this->position]) {
            case 0x2A:
                [$minimum, $maximum] = [0, null];
                $this->position++;
                break;
            case 0x2B:
                [$minimum, $maximum] = [1, null];
                $this->position++;
                break;
            case 0x3F:
                [$minimum, $maximum] = [0, 1];
                $this->position++;
                break;
            case 0x7B:
                [$minimum, $maximum] = $this->bounds();
                break;
            default:
                return $item;
        }
        if ($this->is($this->position, '?')) {
            $this->position++;
        }
        if ($this->position < $this->length && \in_array($this->source[$this->position], self::QUANTIFIERS, true)) {
            throw new PatternSyntaxError('invalid quantifier', $this->position);
        }
        return new Repeat($item, $minimum, $maximum);
    }

    /**
     * `{n}`, `{n,}` or `{n,m}` with decimal digits and n ≤ m ≤ 1000.
     *
     * @return array{int, int|null}
     */
    private function bounds(): array
    {
        $at = $this->position;
        $this->position++;
        $minimum = $this->number();
        $maximum = $minimum;
        if ($minimum !== null && $this->is($this->position, ',')) {
            $this->position++;
            if ($this->is($this->position, '}')) {
                $maximum = null;
            } else {
                $maximum = $this->number();
                if ($maximum === null) {
                    $minimum = null;
                }
            }
        }
        if (
            $minimum === null || !$this->is($this->position, '}') || $minimum > self::MAXIMUM_BOUND
            || ($maximum !== null && ($maximum < $minimum || $maximum > self::MAXIMUM_BOUND))
        ) {
            throw new PatternSyntaxError('invalid quantifier', $at);
        }
        $this->position++;
        return [$minimum, $maximum];
    }

    /** Decimal digits at the position, capped above the bound limit, or null when there are none. */
    private function number(): ?int
    {
        $value = null;
        while (
            $this->position < $this->length
            && $this->source[$this->position] >= 0x30
            && $this->source[$this->position] <= 0x39
        ) {
            $value = min(($value ?? 0) * 10 + $this->source[$this->position] - 0x30, self::MAXIMUM_BOUND + 1);
            $this->position++;
        }
        return $value;
    }

    /** `(…)`, `(?:…)` or `(?<name>…)` opening nesting level $depth. */
    private function group(int $depth): Group
    {
        $at = $this->position;
        if ($depth > self::MAXIMUM_DEPTH) {
            throw new PatternSyntaxError('nesting too deep', $at);
        }
        $this->position++;
        if ($this->is($this->position, '?')) {
            if ($this->is($this->position + 1, ':')) {
                $this->position += 2;
            } elseif (
                $this->is($this->position + 1, '<')
                && !$this->is($this->position + 2, '=')
                && !$this->is($this->position + 2, '!')
            ) {
                $this->position = $this->groupName($at, $this->position + 2);
            } else {
                throw new PatternSyntaxError('unsupported construct', $at);
            }
        }
        $body = $this->alternation($depth);
        $this->position++;
        return new Group($body);
    }

    /** Read a unique group name starting at $start; return the position after `>`. */
    private function groupName(int $at, int $start): int
    {
        $end = $start;
        $name = '';
        while ($end < $this->length && $this->isNameCharacter($this->source[$end])) {
            $name .= \chr($this->source[$end]);
            $end++;
        }
        if ($name === '' || ($name[0] >= '0' && $name[0] <= '9') || !$this->is($end, '>')) {
            throw new PatternSyntaxError('invalid group name', $at);
        }
        if (isset($this->names[$name])) {
            throw new PatternSyntaxError('duplicate group name', $at);
        }
        $this->names[$name] = true;
        return $end + 1;
    }

    private function isNameCharacter(int $character): bool
    {
        return ($character >= 0x30 && $character <= 0x39) || ($character >= 0x41 && $character <= 0x5A)
            || ($character >= 0x61 && $character <= 0x7A) || $character === 0x5F;
    }

    /**
     * `[…]` or `[^…]` with at least one member, read left to right. Invalid members
     * are an `invalid class` at the `[` when read; a set endpoint or a descending range
     * is an `invalid range` at the first endpoint.
     */
    private function bracketClass(): CodePointSet
    {
        $at = $this->position;
        $this->position++;
        $negated = $this->is($this->position, '^');
        if ($negated) {
            $this->position++;
        }
        $first = $this->position;
        $bounds = [];
        $sets = [];
        while (true) {
            if ($this->position >= $this->length) {
                throw new PatternSyntaxError('unterminated class', $this->length);
            }
            if ($this->is($this->position, ']')) {
                if ($bounds === [] && $sets === []) {
                    throw new PatternSyntaxError('invalid class', $at);
                }
                $this->position++;
                $set = CodePointSet::union(CodePointSet::fromBounds($bounds), ...$sets);
                return $negated ? $set->complement() : $set;
            }
            $start = $this->position;
            $member = $this->classMember($at, $first);
            if (
                $this->is($this->position, '-')
                && $this->position + 1 < $this->length
                && !$this->is($this->position + 1, ']')
            ) {
                if (!\is_int($member)) {
                    throw new PatternSyntaxError('invalid range', $start);
                }
                $this->position++;
                $last = $this->classMember($at, $first);
                if (!\is_int($last) || $last < $member) {
                    throw new PatternSyntaxError('invalid range', $start);
                }
                array_push($bounds, $member, $last);
            } elseif (\is_int($member)) {
                array_push($bounds, $member, $member);
            } else {
                $sets[] = $member;
            }
        }
    }

    /** A class member: a code point, or the set of a shorthand or property. */
    private function classMember(int $classAt, int $first): int|CodePointSet
    {
        $at = $this->position;
        $character = $this->source[$at];
        if ($character === 0x5B) {
            throw new PatternSyntaxError('invalid class', $classAt);
        }
        if ($character === 0x5C) {
            return $this->escapeMember($classAt);
        }
        if ($character === 0x2D && $at !== $first && $at + 1 < $this->length && !$this->is($at + 1, ']')) {
            throw new PatternSyntaxError('invalid class', $classAt);
        }
        return $this->literal();
    }

    /** The literal code point at the position; a surrogate is not a literal. */
    private function literal(): int
    {
        $character = $this->source[$this->position];
        if ($character >= 0xD800 && $character <= 0xDFFF) {
            throw new PatternSyntaxError('unexpected character', $this->position);
        }
        $this->position++;
        return $character;
    }

    /** An escape outside a class, as a set. */
    private function escape(): CodePointSet
    {
        $member = $this->escapeMember(null);
        return \is_int($member) ? CodePointSet::fromBounds([$member, $member]) : $member;
    }

    /**
     * An escape: a code point or a set. $classAt is the enclosing class offset, or
     * null outside a class.
     */
    private function escapeMember(?int $classAt): int|CodePointSet
    {
        $at = $this->position;
        if ($at + 1 >= $this->length) {
            throw new PatternSyntaxError('invalid escape', $at);
        }
        $letter = $this->source[$at + 1];
        $ascii = $letter < 0x80 ? \chr($letter) : '';
        if ($ascii !== '' && str_contains(self::ESCAPABLE, $ascii)) {
            $this->position += 2;
            return $letter;
        }
        if (isset(self::CONTROLS[$ascii])) {
            $this->position += 2;
            return self::CONTROLS[$ascii];
        }
        switch ($ascii) {
            case 'x':
                $digits = $this->hexDigits($at + 2, 2);
                if (\strlen($digits) !== 2) {
                    throw new PatternSyntaxError('invalid escape', $at);
                }
                $this->position = $at + 4;
                return (int) hexdec($digits);
            case 'u':
                return $this->codePointEscape($at);
            case 'd':
            case 'w':
            case 's':
                $this->position += 2;
                return PropertySets::shorthand($ascii);
            case 'D':
            case 'W':
            case 'S':
                if ($classAt !== null) {
                    throw new PatternSyntaxError('invalid class', $classAt);
                }
                $this->position += 2;
                $lower = strtolower($ascii);
                return PropertySets::complement("shorthand:$lower", PropertySets::shorthand($lower));
            case 'p':
            case 'P':
                return $this->property($at, $ascii === 'P');
            default:
                throw new PatternSyntaxError('invalid escape', $at);
        }
    }

    /** `\u{H…}` with 1–6 hexadecimal digits naming a scalar value. */
    private function codePointEscape(int $at): int
    {
        if (!$this->is($at + 2, '{')) {
            throw new PatternSyntaxError('invalid escape', $at);
        }
        $digits = $this->hexDigits($at + 3, 7);
        $close = $at + 3 + \strlen($digits);
        if ($digits === '' || \strlen($digits) > 6 || !$this->is($close, '}')) {
            throw new PatternSyntaxError('invalid escape', $at);
        }
        $codePoint = (int) hexdec($digits);
        if ($codePoint > CodePointSet::MAXIMUM || ($codePoint >= 0xD800 && $codePoint <= 0xDFFF)) {
            throw new PatternSyntaxError('invalid escape', $at);
        }
        $this->position = $close + 1;
        return $codePoint;
    }

    /** `\p{X}`, `\P{X}`, `\p{Script=Name}` or `\P{Script=Name}`. */
    private function property(int $at, bool $negated): CodePointSet
    {
        if (!$this->is($at + 2, '{')) {
            throw new PatternSyntaxError('invalid property', $at);
        }
        $name = '';
        $end = $at + 3;
        while ($end < $this->length && !$this->is($end, '}')) {
            $name .= $this->source[$end] < 0x80 ? \chr($this->source[$end]) : "\u{FFFD}";
            $end++;
        }
        if ($end >= $this->length) {
            throw new PatternSyntaxError('invalid property', $at);
        }
        $key = $name;
        $set = PropertySets::category($name);
        if ($set === null && str_starts_with($name, 'Script=')) {
            $key = 'sc:' . substr($name, 7);
            $set = PropertySets::script(substr($name, 7));
        }
        if ($set === null) {
            throw new PatternSyntaxError('invalid property', $at);
        }
        $this->position = $end + 1;
        return $negated ? PropertySets::complement($key, $set) : $set;
    }

    /** Up to $limit hexadecimal digits starting at $start. */
    private function hexDigits(int $start, int $limit): string
    {
        $digits = '';
        for ($index = $start; $index < $this->length && \strlen($digits) < $limit; $index++) {
            $character = $this->source[$index];
            if (
                !(($character >= 0x30 && $character <= 0x39) || ($character >= 0x41 && $character <= 0x46)
                || ($character >= 0x61 && $character <= 0x66))
            ) {
                break;
            }
            $digits .= \chr($character);
        }
        return $digits;
    }

    /** Whether the code point at $index is the ASCII character $character. */
    private function is(int $index, string $character): bool
    {
        return $index < $this->length && $this->source[$index] === \ord($character);
    }
}
