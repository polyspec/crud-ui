<?php

declare(strict_types=1);

require __DIR__ . '/../../../../../vendor/autoload.php';

use Polyspec\Crudui\Validator;
use Polyspec\Crudui\Validator\Compose\ComposeLoadError;
use Polyspec\Crudui\Validator\Support\JsonText;
use Polyspec\Crudui\Validator\Support\Text;
use Polyspec\Crudui\Validator\Validate\FormInputError;

/*
 * PHP validator process of the cross-check console. It reads one JSON request on
 * standard input, calls the public API of polyspec/crudui-validator and writes one JSON
 * response on standard output with the exit status; ../README.md defines the
 * contract. With the native extension loaded, the same program runs the
 * extension's classes. A form result exits 0 with {valid, errors, hidden}, a
 * list or detail result with {valid, errors}. A load or input
 * failure exits 2 with {error, code, at}. A malformed request exits 1 with
 * exactly {error}. The request is checked in this order:
 *  1. stdin is not UTF-8 or not valid JSON     → "Request must be valid JSON"
 *  2. the request is not a JSON object         → "Request must be an object"
 *  3. spec absent or not an object             → "Request spec must be an object"
 *  4. mode present and not exactly "form", "list" or "detail" (null and
 *     non-strings included)                    → "Unsupported validation mode"
 *  5. files present, not null, not an object   → "Request files must be an object"
 *  6. a files member is not an object          → "Request files must contain objects"
 *  7. basepath present, not null, not a string → "Request basepath must be a string"
 * Absent or null files and basepath mean none. An absent mode is "form"; "list"
 * runs validateList and "detail" runs validateDetail, both ignoring data. In
 * form mode an absent data member validates {}; a present value that is not an
 * object, null included, is an input failure (exit 2, INVALID_FORM_INPUT).
 */

$emit = static function (array|stdClass $output, int $status): never {
    echo json_encode($output, JSON_UNESCAPED_SLASHES | JSON_UNESCAPED_UNICODE | JSON_THROW_ON_ERROR), "\n";
    exit($status);
};

$reject = static function (string $message) use ($emit): never {
    $emit(['error' => $message], 1);
};

// Standard input that is not UTF-8 is not JSON text. JsonText keeps an unpaired surrogate
// escape as text the validator rejects instead of failing like json_decode.
$input = stream_get_contents(STDIN);
if (!is_string($input) || preg_match('//u', $input) !== 1) {
    $reject('Request must be valid JSON');
}
try {
    $request = JsonText::decode($input);
} catch (JsonException) {
    $reject('Request must be valid JSON');
}
if (!$request instanceof stdClass) {
    $reject('Request must be an object');
}
if (!property_exists($request, 'spec') || !$request->spec instanceof stdClass) {
    $reject('Request spec must be an object');
}
$mode = property_exists($request, 'mode') ? $request->mode : 'form';
if (!in_array($mode, ['form', 'list', 'detail'], true)) {
    $reject('Unsupported validation mode');
}
$files = $request->files ?? new stdClass();
if (!$files instanceof stdClass) {
    $reject('Request files must be an object');
}
foreach ($files as $file) {
    if (!$file instanceof stdClass) {
        $reject('Request files must contain objects');
    }
}
$basepath = $request->basepath ?? '';
if (!is_string($basepath)) {
    $reject('Request basepath must be a string');
}

try {
    $options = ['files' => $files, 'basepath' => $basepath];
    if ($mode === 'list') {
        $output = Validator::validateList($request->spec, $options);
    } elseif ($mode === 'detail') {
        $output = Validator::validateDetail($request->spec, $options);
    } else {
        $data = property_exists($request, 'data') ? $request->data : new stdClass();
        if (!$data instanceof stdClass) {
            // The PHP API takes only an object, so the input text rules that precede the data
            // shape rule are applied here in the library's order.
            $failure = Text::specificationFailure($request->spec, $files)
                ?? Text::inputFailure([['data', $data], ['options.basepath', $basepath]]);
            throw new FormInputError($failure ?? 'Form data must be an object');
        }
        $result = Validator::validate($request->spec, $data, $options);
        $output = ['valid' => $result->valid, 'errors' => $result->errors, 'hidden' => $result->hidden];
    }
} catch (ComposeLoadError $error) {
    $emit(
        [
            'error' => $error->getMessage(),
            'code' => $error->getErrorCode(),
            'at' => implode('.', $error->getCompositionTrace())
        ],
        2
    );
} catch (FormInputError $error) {
    $emit(['error' => $error->getMessage(), 'code' => $error->getErrorCode(), 'at' => ''], 2);
} catch (Throwable $error) {
    $emit(['error' => $error->getMessage()], 1);
}
$emit($output, 0);
