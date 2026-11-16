<?php

/**
 * The shared steps of the PHP table generators: read a JSON contract of contracts/ and check its format, and write a
 * generated source or print it with --stdout.
 */

declare(strict_types=1);

/**
 * Read contracts/<name>.json of the repository and require its `format` member to be crudui/<name>.
 *
 * @return array<string, mixed>
 */
function crudui_read_contract(string $repositoryRoot, string $name): array
{
    $contract = json_decode(
        (string) file_get_contents($repositoryRoot . '/contracts/' . $name . '.json'),
        true,
        512,
        JSON_THROW_ON_ERROR
    );
    if (($contract['format'] ?? null) !== 'crudui/' . $name) {
        throw new RuntimeException('Unexpected contract format');
    }

    return $contract;
}

/**
 * Print a generated source when --stdout is an argument, else write it to the file.
 *
 * @param list<string> $arguments
 */
function crudui_emit_source(string $source, string $file, array $arguments): void
{
    if (in_array('--stdout', $arguments, true)) {
        echo $source;
    } else {
        // The source is written to <file>.<pid> and renamed into place, so a run that reads it finds the previous
        // source or the new one.
        $staging = $file . '.' . getmypid();
        file_put_contents($staging, $source);
        rename($staging, $file);
    }
}

/**
 * Read contracts/<name>.json, build its source with $build, and print the source with --stdout or write it to $file.
 * Every generator script runs this way: `php <script>` writes its source, `php <script> --stdout` prints it.
 *
 * @param list<string> $arguments
 * @param callable(array<string, mixed>): string $build
 */
function crudui_generate(string $repositoryRoot, string $name, string $file, array $arguments, callable $build): void
{
    crudui_emit_source($build(crudui_read_contract($repositoryRoot, $name)), $file, $arguments);
}
