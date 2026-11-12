<?php

declare(strict_types=1);

namespace Polyspec\Crudui\Generator;

use stdClass;

/**
 * Row view state of form instances, kept outside the record data.
 *
 * A view is `['collapsed' => list<string>]`: the row paths `{collection}.{key}` rendered collapsed, in the order the
 * rows were collapsed and without duplicates. Every function returns a new view and changes none that it receives.
 */
final class View
{
    /** The view with no collapsed row. */
    public static function initial(): array
    {
        return ['collapsed' => []];
    }

    /** The row paths of every collapsible row of the evaluated nodes, depth first in node order. */
    public static function collapsibleRows(array $nodes): array
    {
        $rows = [];
        foreach ($nodes as $node) {
            $children = $node->children ?? [];
            if (($node->kind ?? null) !== 'collection') {
                array_push($rows, ...self::collapsibleRows($children));
                continue;
            }
            foreach ($children as $row) {
                if (($row->collapsible ?? false) === true) {
                    $rows[] = $node->path . '.' . $row->key;
                }
                array_push($rows, ...self::collapsibleRows($row->children ?? []));
            }
        }
        return $rows;
    }

    /** Expand a collapsed row or collapse an expanded one, appending a collapsed row last. */
    public static function toggle(array $view, string $rowPath): array
    {
        $collapsed = array_values(array_filter($view['collapsed'], static fn (string $path) => $path !== $rowPath));
        if (count($collapsed) === count($view['collapsed'])) {
            $collapsed[] = $rowPath;
        }
        return ['collapsed' => $collapsed];
    }

    /** The view with no collapsed row, or the view that collapses every collapsible row of the nodes. */
    public static function setAllExpanded(array $nodes, bool $expanded): array
    {
        return $expanded ? self::initial() : ['collapsed' => self::collapsibleRows($nodes)];
    }

    /** Drop the collapsed state of a removed row and of the rows inside it. */
    public static function removeRow(array $view, string $rowPath): array
    {
        return ['collapsed' => array_values(array_filter(
            $view['collapsed'],
            static fn (string $path) => !self::inside($rowPath, $path)
        ))];
    }

    /** Move the collapsed state of a rekeyed row and of the rows inside it to the new row path. */
    public static function rekeyRow(array $view, string $oldPath, string $newPath): array
    {
        $moved = array_map(
            static fn (string $path) => self::inside($oldPath, $path)
                ? $newPath . substr($path, strlen($oldPath))
                : $path,
            $view['collapsed']
        );
        return ['collapsed' => array_values(array_unique($moved))];
    }

    /** Whether `$path` is the row path `$rowPath` or lies inside that row. */
    private static function inside(string $rowPath, string $path): bool
    {
        return $path === $rowPath || str_starts_with($path, $rowPath . '.');
    }
}
