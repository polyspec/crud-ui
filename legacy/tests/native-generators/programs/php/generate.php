<?php

declare(strict_types=1);

require __DIR__ . '/../../../../../vendor/autoload.php';

use Polyspec\Crudui\Form;
use Polyspec\Crudui\FormError;
use Polyspec\Crudui\Generator;
use Polyspec\Crudui\Validator\Compose\ComposeLoadError;
use Polyspec\Crudui\Validator\Support\JsonText;

/*
 * PHP generator process of the native generator conformance suite. It reads one JSON
 * request on standard input, calls the public API of polyspec/crudui-generator and writes one
 * JSON value on standard output; ../../README.md defines the protocol. With the native
 * extension loaded, the same program runs the extension's classes.
 */

$failure = static function (Throwable $error): array {
    return [
        'code' => $error instanceof ComposeLoadError
            || $error instanceof FormError
            ? $error->getErrorCode()
            : 'INVALID_FORM_INPUT',
        'message' => $error->getMessage(),
        'at' => $error instanceof FormError ? $error->getPath() : ($error instanceof ComposeLoadError ? implode(
            '.',
            $error->getCompositionTrace()
        ) : '')
    ];
};
$state = static function (Form $form): array {
    return [
        'data' => $form->getData(),
        'fields' => $form->getFields(),
        'html' => Generator::renderForm($form),
        'revision' => $form->getRevision()
    ];
};
/** A protocol JSON object; a JSON array or scalar is not an object in any runtime. */
$objectValue = static function (mixed $value, string $message): stdClass {
    if (!$value instanceof stdClass) {
        throw new InvalidArgumentException($message);
    }
    return $value;
};
/** The request member, or null when it is absent. */
$member = static function (stdClass $request, string $key): mixed {
    return property_exists($request, $key) ? $request->{$key} : null;
};
/** A form template is a JSON object; the library checks its kind. */
$template = static function (stdClass $request) use ($objectValue, $member): stdClass {
    return $objectValue($member($request, 'template'), 'Unsupported form template');
};
$options = static function (mixed $value): array {
    if (!$value instanceof stdClass) {
        throw new InvalidArgumentException('Options must be an object');
    }
    return (array) $value;
};
try {
    // Standard input that is not UTF-8 is not JSON text. JsonText keeps an unpaired surrogate
    // escape as text the generator rejects instead of failing like json_decode.
    $input = stream_get_contents(STDIN);
    try {
        if (!is_string($input) || preg_match('//u', $input) !== 1) {
            throw new JsonException('Malformed UTF-8 characters', JSON_ERROR_UTF8);
        }
        $request = JsonText::decode($input);
    } catch (JsonException $error) {
        throw new InvalidArgumentException('Request must be valid JSON', 0, $error);
    }
    if (!$request instanceof stdClass) {
        throw new InvalidArgumentException('Request must be an object');
    }
    switch ($request->operation ?? null) {
        case 'compileForm':
            $result = Generator::compileForm(
                $objectValue($member($request, 'spec'), 'A form spec must be a group with properties'),
                $options(property_exists($request, 'options') ? $request->options : new stdClass())
            );
            break;
        case 'bindForm':
            $result = Generator::bindForm(
                $template($request),
                property_exists($request, 'data') ? $objectValue(
                    $request->data,
                    'Form data must be an object'
                ) : new stdClass(),
                $options(property_exists($request, 'options') ? $request->options : new stdClass())
            );
            break;
        case 'bindButtons':
            $result = Generator::bindButtons(
                $template($request),
                property_exists($request, 'data') ? $objectValue(
                    $request->data,
                    'Form data must be an object'
                ) : new stdClass(),
                $options(property_exists($request, 'options') ? $request->options : new stdClass())
            );
            break;
        case 'formButtonsHtml':
            $buttons = $member($request, 'buttons');
            if (!is_array($buttons)) {
                throw new InvalidArgumentException('Form buttons must be a list');
            }
            $result = Generator::formButtonsHtml($buttons);
            break;
        case 'renderList':
            // The JSON types reach the library unchanged: it checks the shape of the specification, the rows and the
            // record in argument order (docs/spec/display-formats.md).
            $spec = $member($request, 'spec');
            $rows = property_exists($request, 'rows') ? $request->rows : [];
            $listOptions = $options(property_exists($request, 'options') ? $request->options : new stdClass());
            $result = Generator::renderList($spec, $rows, $listOptions);
            break;
        case 'buildList':
            $spec = $member($request, 'spec');
            $rows = property_exists($request, 'rows') ? $request->rows : [];
            $listOptions = $options(property_exists($request, 'options') ? $request->options : new stdClass());
            $result = Generator::buildList($spec, $rows, $listOptions);
            break;
        case 'buildOutline':
            $nodes = $member($request, 'nodes');
            if (!is_array($nodes)) {
                throw new InvalidArgumentException('Outline nodes must be a list');
            }
            foreach ($nodes as $node) {
                $objectValue($node, 'Outline nodes must be evaluated node objects');
            }
            $result = Generator::buildOutline($nodes);
            break;
        case 'buildDetail':
        case 'renderDetail':
            $method = $request->operation;
            $spec = $member($request, 'spec');
            $record = property_exists($request, 'record') ? $request->record : new stdClass();
            $detailOptions = $options(property_exists($request, 'options') ? $request->options : new stdClass());
            $result = Generator::$method($spec, $record, $detailOptions);
            break;
        case 'renderForm':
            $form = new Form(
                $template($request),
                property_exists($request, 'data') ? $objectValue(
                    $request->data,
                    'Form data must be an object'
                ) : new stdClass(),
                $options(property_exists($request, 'options') ? $request->options : new stdClass())
            );
            $result = Generator::renderForm(
                $form,
                property_exists($request, 'render') ? $request->render : new stdClass()
            );
            break;
        case 'form':
            $form = new Form(
                $template($request),
                property_exists($request, 'data') ? $objectValue(
                    $request->data,
                    'Form data must be an object'
                ) : new stdClass(),
                $options(property_exists($request, 'options') ? $request->options : new stdClass())
            );
            $steps = [];
            $actions = property_exists($request, 'actions') ? $request->actions : [];
            if (!is_array($actions)) {
                throw new InvalidArgumentException('Actions must be an array');
            }
            foreach ($actions as $action) {
                $value = null;
                $error = null;
                try {
                    $method = $action instanceof stdClass ? ($action->method ?? null) : null;
                    $args = $action instanceof stdClass && property_exists($action, 'args') ? $action->args : null;
                    if (
                        !in_array(
                            $method,
                            [
                                'setData',
                                'setValue',
                                'addRow',
                                'copyRow',
                                'removeRow',
                                'moveRow',
                                'rekeyRow',
                                'getValue',
                                'getData'
                            ],
                            true
                        )
                        || !is_array($args)
                    ) {
                        throw new InvalidArgumentException('Invalid form action');
                    }
                    if ($method === 'setData' && array_key_exists(0, $args)) {
                        $args[0] = $objectValue($args[0], 'Form data must be an object');
                    }
                    $optionIndex = $method === 'addRow' ? 1 : ($method === 'copyRow' ? 2 : null);
                    if ($optionIndex !== null && array_key_exists($optionIndex, $args)) {
                        $args[$optionIndex] = $options($args[$optionIndex]);
                    }
                    $value = $form->{$method}(...$args);
                } catch (Throwable $caught) {
                    $error = $failure($caught);
                }
                $steps[] = ['result' => $value, 'error' => $error, ...$state($form)];
            }
            $result = [...$state($form), 'steps' => $steps];
            break;
        default:
            throw new InvalidArgumentException('Unknown generator operation');
    }
    echo json_encode($result, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR) . "\n";
} catch (Throwable $error) {
    echo json_encode(
        ['error' => $failure($error)],
        JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR
    ) . "\n";
    exit(1);
}
