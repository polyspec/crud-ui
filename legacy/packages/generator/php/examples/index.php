<?php

declare(strict_types=1);

require __DIR__ . '/../../../../../vendor/autoload.php';
use Polyspec\Crudui\Form;
use Polyspec\Crudui\Generator;
use Polyspec\Crudui\Validator;
use Polyspec\Crudui\Validator\Validate\FormInputError;

$path = getenv('CRUDUI_DATA_FILE');
if ($path === false || $path === '') {
    http_response_code(500);
    exit('Set CRUDUI_DATA_FILE to the record file path.');
}
// The form, list and detail specifications describe the same record. The example stores one
// record: the form edits it, the list shows it as its only row and the detail shows it.
$spec = json_decode(<<<'JSON'
{"type":"group","properties":{"name":{"type":"text","label":"Name","validate":{"required":true}},
"email":{"type":"email","label":"Email","validate":{"email":true}},"level":{"type":"choice","label":"Level",
"items":{"beginner":"Beginner","intermediate":"Intermediate","advanced":"Advanced"}},"topics":{"type":"multichoice",
"label":"Topics","items":{"forms":"Forms","validation":"Validation","rendering":"Rendering"}},"note":{"type":"textarea",
"label":"Note"}}}
JSON, false, 512, JSON_THROW_ON_ERROR);
// The list links each name to the detail page, shows the level label and truncates the note.
$listSpec = json_decode(<<<'JSON'
{"columns":{"name":{"field":"name","label":"Name","format":{"type":"link","href":"/?view=detail"}},
"email":{"field":"email","label":"Email","format":"text"},"level":{"field":"level","label":"Level",
"format":{"type":"choice-label","items":{"beginner":"Beginner","intermediate":"Intermediate","advanced":"Advanced"}}},
"note":{"field":"note","label":"Note","format":{"type":"text","truncate":40}}}}
JSON, false, 512, JSON_THROW_ON_ERROR);
// The detail shows the name as text, the email as a mailto link, the level label and the note.
$detailSpec = json_decode(<<<'JSON'
{"fields":{"name":{"field":"name","label":"Name","format":"text"},"email":{"field":"email","label":"Email",
"format":{"type":"link","href":"mailto:{=email}"}},"level":{"field":"level","label":"Level",
"format":{"type":"choice-label","items":{"beginner":"Beginner","intermediate":"Intermediate","advanced":"Advanced"}}},
"note":{"field":"note","label":"Note","format":"text"}}}
JSON, false, 512, JSON_THROW_ON_ERROR);
$stored = is_file($path);
$data = $stored ? json_decode(file_get_contents($path), false, 512, JSON_THROW_ON_ERROR) : new stdClass();
if (!$data instanceof stdClass) {
    throw new RuntimeException('Stored record must be an object');
}
$view = $_GET['view'] ?? 'form';
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';
if (!in_array($view, ['form', 'list', 'detail'], true)) {
    http_response_code(404);
    exit('Unknown view.');
}
if ($view !== 'form' && $method !== 'GET') {
    header('Allow: GET');
    http_response_code(405);
    exit('Method not allowed.');
}
$errors = [];
if ($view === 'form' && $method === 'POST') {
    $submitted = $_POST['form'] ?? [];
    if (!is_array($submitted)) {
        http_response_code(400);
        exit('Form data must be an object.');
    }
    $submitted['topics'] ??= [];
    try {
        $result = Validator::validate($spec, $submitted);
    } catch (FormInputError $error) {
        http_response_code(400);
        exit($error->getMessage());
    }
    $data = (object) $submitted;
    if ($result->valid) {
        $json = json_encode(
            $data,
            JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR
        )
            . "\n";
        if (file_put_contents($path, $json, LOCK_EX) === false) {
            throw new RuntimeException('Record write failed');
        }
        header('Location: /', true, 303);
        exit;
    }
    http_response_code(422);
    $errors = $result->errors;
}
if ($view === 'list') {
    // No record file means no rows.
    $body = Generator::renderList($listSpec, $stored ? [$data] : [], ['language' => 'en']);
} elseif ($view === 'detail') {
    // No record file means an empty record.
    $body = Generator::renderDetail($detailSpec, $data, ['language' => 'en']);
} else {
    $template = Generator::compileForm($spec, ['keyPrefix' => 'form']);
    $form = new Form($template, $data, ['language' => 'en']);
    $body = '<form method="post">' . Generator::renderForm($form) . '</form>';
}
// The generated markup takes every style from the core stylesheet; the page styles only its own layout.
$stylesheet = file_get_contents(__DIR__ . '/../../ts/styles/crudui.css');
if ($stylesheet === false) {
    throw new RuntimeException('Stylesheet read failed');
}
header('Content-Type: text/html; charset=UTF-8');
$title = 'CRUDUI PHP ' . $view;
?>
<!doctype html>
<html lang="en">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title><?php echo $title; ?></title>
<style>
body { font: 16px system-ui; max-width: 720px; margin: 2rem auto; padding: 0 1rem; }
</style>
<style>
<?php
echo $stylesheet;
?>
</style>
<h1><?php echo $title; ?></h1>
<nav><a href="/">Form</a> · <a href="/?view=list">List</a> · <a href="/?view=detail">Detail</a></nav>
<?php
foreach ($errors as $error) {
    ?>
<p role="alert"><?php
    echo htmlspecialchars($error->path . ': ' . $error->message, ENT_QUOTES, 'UTF-8');
?></p>
    <?php
}
echo $body;
?>
</html>
