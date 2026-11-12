<?php

/** @generate-class-entries */

namespace Polyspec\Crudui {
    final class Generator {
        public static function compileForm(array|\stdClass $spec, array $options = []): \stdClass {}
        public static function bindForm(\stdClass $template, mixed $data = [], array $options = []): array {}
        public static function bindButtons(\stdClass $template, mixed $data = [], array $options = []): array {}
        public static function formButtonsHtml(mixed $buttons): string {}
        public static function renderForm(Form $form, mixed $options = []): string {}
        public static function renderList(mixed $spec, mixed $rows, array $options = []): string {}
        public static function buildList(mixed $spec, mixed $rows = [], array $options = []): \stdClass {}
        public static function buildOutline(array $nodes): array {}
        public static function resolveAction(array|\stdClass $input): ?\stdClass {}
        public static function runAction(Form $form, array|\stdClass $target): ?\stdClass {}
        public static function initialView(): array {}
        public static function collapsibleRows(array $nodes): array {}
        public static function toggleRowView(array $view, string $rowPath): array {}
        public static function setAllExpandedView(array $nodes, bool $expanded): array {}
        public static function removeRowView(array $view, string $rowPath): array {}
        public static function rekeyRowView(array $view, string $oldPath, string $newPath): array {}
        public static function emptyHistory(): \stdClass {}
        public static function recordChange(\stdClass $history, mixed $previous, ?string $path = null): \stdClass {}
        public static function canUndo(\stdClass $history): bool {}
        public static function canRedo(\stdClass $history): bool {}
        public static function undoChange(\stdClass $history, mixed $current): \stdClass {}
        public static function redoChange(\stdClass $history, mixed $current): \stdClass {}
        public static function renderDetail(mixed $spec, mixed $record = new \stdClass(), array $options = []): string {}
        public static function buildDetail(mixed $spec, mixed $record = new \stdClass(), array $options = []): \stdClass {}
        public static function sequenceRowKey(int|string $sequence): string {}
        public static function createRowKey(): string {}
    }
    final class Validator {
        public static function validate(array|\stdClass $spec, array|\stdClass $data, array $options = []): \stdClass {}
        public static function validateList(array|\stdClass $spec, array $options = []): \stdClass {}
        public static function validateDetail(array|\stdClass $spec, array $options = []): \stdClass {}
    }
    final class Form {
        public function __construct(\stdClass $template, mixed $data = [], array $options = []) {}
        public function getTemplate(): \stdClass {}
        public function getFields(): array {}
        public function getButtons(): array {}
        public function getMessages(): array {}
        public function getDescription(): string {}
        public function getRevision(): int {}
        public function getData(): \stdClass {}
        public function getValue(string $path): mixed {}
        public function setData(mixed $data): void {}
        public function setValue(string $path, mixed $value): void {}
        public function addRow(string $path, array $options = []): string {}
        public function copyRow(string $path, string $key, array $options = []): string {}
        public function removeRow(string $path, string $key): void {}
        public function moveRow(string $path, string $key, int $index): void {}
        public function rekeyRow(string $path, string $oldKey, string $newKey): void {}
        public function toggleRow(string $path, string $key): void {}
        public function setAllExpanded(bool $expanded): void {}
        public function undo(): void {}
        public function redo(): void {}
        public function canUndo(): bool {}
        public function canRedo(): bool {}
    }
    final class FormError extends \RuntimeException {
        private readonly string $errorCode;
        private readonly string $path;
        public function __construct(string $errorCode, string $message, string $path = '', ?\Throwable $previous = null) {}
        public function getErrorCode(): string {}
        public function getPath(): string {}
    }
}

namespace Polyspec\Crudui\Validator\Compose {
    final class ComposeLoadError extends \RuntimeException {
        private readonly string $errorCode;
        private readonly array $compositionTrace;
        public function __construct(string $code, string $message, array $trace = [], ?\Throwable $previous = null) {}
        public function getErrorCode(): string {}
        public function getCompositionTrace(): array {}
        public function __get(string $name): mixed {}
        public function __isset(string $name): bool {}
    }
}

namespace Polyspec\Crudui\Validator\Validate {
    final class FormInputError extends \RuntimeException {
        private readonly string $errorCode;
        public function __construct(string $message) {}
        public function getErrorCode(): string {}
    }
}
