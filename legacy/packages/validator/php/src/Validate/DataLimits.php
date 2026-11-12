<?php

declare(strict_types=1);

namespace Polyspec\Crudui\Validator\Validate;

use Polyspec\Crudui\Validator\Compose\ComposeLoadError;
use Polyspec\Crudui\Validator\Support\Text;
use Polyspec\Crudui\Validator\Values\LengthLimit;
use stdClass;

/**
 * The data limits of a form root (validation-rules.md, "Data limits"): the bounds of the levels and the nodes of the
 * submitted data.
 */
final class DataLimits
{
    /** The levels of a form root that declares none (CUVR-083). */
    public const DEPTH = 64;

    /** The nodes of a form root that declares none (CUVR-083). */
    public const VALUES = 100000;

    /**
     * The `dataLimits` of a form root as [depth, values], a missing member taking its default.
     *
     * @param array<string, mixed> $root
     * @return array{int, int}
     * @throws ComposeLoadError for a bad one (CUVR-084)
     */
    public static function read(array $root): array
    {
        if (!array_key_exists('dataLimits', $root)) {
            return [self::DEPTH, self::VALUES];
        }
        $declared = $root['dataLimits'];
        $object = $declared instanceof stdClass
            || is_array($declared) && ($declared === [] || !array_is_list($declared));
        if (!$object) {
            throw self::bad();
        }
        $limits = ['depth' => self::DEPTH, 'values' => self::VALUES];
        foreach ((array) $declared as $key => $value) {
            $maximum = match ((string) $key) {
                'depth' => Text::NESTING_LIMIT,
                'values' => Text::NODE_LIMIT,
                default => throw self::bad(),
            };
            $limit = LengthLimit::integer($value);
            if ($limit === null || $limit < 1 || $limit > $maximum) {
                throw self::bad();
            }
            $limits[(string) $key] = $limit;
        }
        return [$limits['depth'], $limits['values']];
    }

    /**
     * Data beyond its limits is an input failure, its levels checked before its nodes (CUVR-082).
     *
     * @param array{int, int} $limits
     * @throws FormInputError
     */
    public static function check(mixed $data, array $limits): void
    {
        [$levels, $nodes] = Text::size($data);
        [$depth, $values] = $limits;
        if ($levels > $depth) {
            throw new FormInputError("Submitted data exceeds the depth limit of $depth");
        }
        if ($nodes > $values) {
            throw new FormInputError("Submitted data exceeds the values limit of $values");
        }
    }

    private static function bad(): ComposeLoadError
    {
        return new ComposeLoadError(
            'INVALID_RULE_PARAMETER',
            'Invalid dataLimits parameter: expected depth from 1 to ' . Text::NESTING_LIMIT
                . ' and values from 1 to ' . Text::NODE_LIMIT,
        );
    }
}
