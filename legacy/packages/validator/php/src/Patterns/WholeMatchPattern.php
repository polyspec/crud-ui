<?php

declare(strict_types=1);

namespace Polyspec\Crudui\Validator\Patterns;

/**
 * A CRUDUI pattern compiled to its NFA, matching whole texts.
 *
 * @internal
 */
final class WholeMatchPattern
{
    /** Number of compiled patterns kept between calls. */
    private const CACHE_SIZE = 256;

    /** @var array<string, self|PatternSyntaxError> */
    private static array $cache = [];

    private function __construct(private readonly Nfa $nfa)
    {
    }

    /**
     * Check a pattern against the language and compile it; results are cached per
     * pattern string.
     *
     * @throws PatternSyntaxError when the pattern is outside the language
     */
    public static function compile(string $pattern): self
    {
        $compiled = self::$cache[$pattern] ?? null;
        if ($compiled === null) {
            try {
                $compiled = new self(NfaCompiler::compile(PatternParser::parse($pattern)));
            } catch (PatternSyntaxError $error) {
                $compiled = $error;
            }
            if (\count(self::$cache) >= self::CACHE_SIZE) {
                self::$cache = [];
            }
            self::$cache[$pattern] = $compiled;
        }
        if ($compiled instanceof PatternSyntaxError) {
            throw new PatternSyntaxError($compiled->reason, $compiled->offset);
        }
        return $compiled;
    }

    /**
     * Whether the whole UTF-8 text matches the pattern, which the automaton of the pattern decides.
     *
     * @throws \InvalidArgumentException when the automaton rejects the text as not valid UTF-8
     */
    public function matches(string $text): bool
    {
        return $this->nfa->matches($text);
    }

    /** The number of NFA states. */
    public function stateCount(): int
    {
        return $this->nfa->stateCount();
    }
}
