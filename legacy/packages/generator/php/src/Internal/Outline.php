<?php

declare(strict_types=1);

namespace Polyspec\Crudui\Generator;

use stdClass;

/** The structure map model derived from evaluated nodes: one entry per form row. */
final class Outline
{
    /**
     * Build the structure map: the form's rows, nested as in the form. Collections, counts and empty collections are
     * not rows.
     *
     * @param list<stdClass> $nodes evaluated nodes
     * @return list<stdClass>
     */
    public static function build(array $nodes): array
    {
        return self::rows($nodes);
    }

    /**
     * The rows under the nodes, looking through every node that is not a collection.
     *
     * @param list<stdClass> $nodes
     * @return list<stdClass>
     */
    private static function rows(array $nodes): array
    {
        $rows = [];
        foreach ($nodes as $node) {
            if (($node->kind ?? null) !== 'collection') {
                array_push($rows, ...self::rows(self::children($node)));
                continue;
            }
            foreach (self::children($node) as $row) {
                $rows[] = self::entry($node->path ?? '', $row);
            }
        }
        return $rows;
    }

    /** The entry of one row of the collection at `$path`, with the rows nested in it. */
    private static function entry(string $path, stdClass $row): stdClass
    {
        $entry = new stdClass();
        $entry->path = $path;
        $entry->key = $row->key ?? '';
        foreach (['number', 'title'] as $name) {
            if (isset($row->header->$name)) {
                $entry->$name = $row->header->$name;
            }
        }
        if (($row->controls->placement ?? null) === 'outline') {
            $entry->controls = $row->controls;
        }
        $entry->rows = self::rows(self::children($row));
        return $entry;
    }

    /**
     * The child nodes of a node, none when it has no children list.
     *
     * @return list<stdClass>
     */
    private static function children(stdClass $node): array
    {
        return is_array($node->children ?? null) ? $node->children : [];
    }
}
