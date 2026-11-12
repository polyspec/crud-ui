<?php

declare(strict_types=1);

namespace Polyspec\Crudui\Generator\Tests;

use stdClass;

/** Names the row keys that an operation generated `$1`, `$2` in order of first appearance. */
final class FixtureNamer
{
    /** @var array<string, true> */
    private array $known = [];

    /** @var array<string, string> */
    private array $generated = [];

    /** Collect the keys that the texts of a case write. */
    public function __construct(string $text)
    {
        preg_match_all('/__[0-9A-Za-z]{13}__/', $text, $found);
        foreach ($found[0] as $key) {
            $this->known[$key] = true;
        }
    }

    /** The value with the generated keys of its strings and member names named. */
    public function walk(mixed $value): mixed
    {
        if (is_string($value)) {
            return $this->rename($value);
        }
        if (is_array($value)) {
            return array_map(fn ($item) => $this->walk($item), $value);
        }
        if ($value instanceof stdClass) {
            $out = new stdClass();
            foreach ($value as $key => $member) {
                $out->{$this->rename((string) $key)} = $this->walk($member);
            }
            return $out;
        }
        return $value;
    }

    private function rename(string $text): string
    {
        return preg_replace_callback('/__[0-9A-Za-z]{13}__/', function (array $match): string {
            $key = $match[0];
            if (isset($this->known[$key])) {
                return $key;
            }
            return $this->generated[$key] ??= '$' . (count($this->generated) + 1);
        }, $text) ?? $text;
    }
}
