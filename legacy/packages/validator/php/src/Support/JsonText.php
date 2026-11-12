<?php

declare(strict_types=1);

namespace Polyspec\Crudui\Validator\Support;

use JsonException;
use stdClass;

/**
 * Decode JSON text as json_decode($json, false, 512, JSON_THROW_ON_ERROR) does, keeping every
 * string and member name as written (docs/spec/input-text.md). An unpaired surrogate escape
 * becomes the three-byte encoding of that surrogate and a byte that is not UTF-8 is kept, so both
 * remain text that is not valid UTF-8 and the input text check rejects them. Nothing is replaced.
 * The file has no dependencies, so a program can load it without an autoloader.
 */
final class JsonText
{
    private const DEPTH = 512;

    private string $text;

    private int $pos = 0;

    private int $length;

    private function __construct(string $text)
    {
        $this->text = $text;
        $this->length = strlen($text);
    }

    /** Decode one JSON document; objects become stdClass values. */
    public static function decode(string $json): mixed
    {
        try {
            return json_decode($json, false, self::DEPTH, JSON_THROW_ON_ERROR);
        } catch (JsonException $error) {
            if ($error->getCode() !== JSON_ERROR_UTF16 && $error->getCode() !== JSON_ERROR_UTF8) {
                throw $error;
            }
        }
        $parser = new self($json);
        $value = $parser->value(0);
        $parser->space();
        if ($parser->pos !== $parser->length) {
            $parser->fail();
        }
        return $value;
    }

    private function fail(): never
    {
        throw new JsonException('Syntax error', JSON_ERROR_SYNTAX);
    }

    private function space(): void
    {
        $this->pos += strspn($this->text, " \t\n\r", $this->pos);
    }

    private function value(int $depth): mixed
    {
        $this->space();
        $char = $this->text[$this->pos] ?? '';
        if ($char === '{' || $char === '[') {
            // json_decode counts the values inside the deepest container as one more level.
            if ($depth >= self::DEPTH - 1) {
                throw new JsonException('Maximum stack depth exceeded', JSON_ERROR_DEPTH);
            }
            $this->pos++;
            $close = $char === '{' ? '}' : ']';
            $object = $char === '{';
            $out = $object ? new stdClass() : [];
            $this->space();
            if (($this->text[$this->pos] ?? '') === $close) {
                $this->pos++;
                return $out;
            }
            while (true) {
                $this->space();
                if ($object) {
                    if (($this->text[$this->pos] ?? '') !== '"') {
                        $this->fail();
                    }
                    $name = $this->string();
                    if ($name !== '' && $name[0] === "\0") {
                        throw new JsonException(
                            'The decoded property name is invalid',
                            JSON_ERROR_INVALID_PROPERTY_NAME
                        );
                    }
                    $this->space();
                    if (($this->text[$this->pos] ?? '') !== ':') {
                        $this->fail();
                    }
                    $this->pos++;
                    $out->{$name} = $this->value($depth + 1);
                } else {
                    $out[] = $this->value($depth + 1);
                }
                $this->space();
                $next = $this->text[$this->pos] ?? '';
                $this->pos++;
                if ($next === $close) {
                    return $out;
                }
                if ($next !== ',') {
                    $this->fail();
                }
            }
        }
        if ($char === '"') {
            return $this->string();
        }
        if (
            preg_match(
                '/\G(?:true|false|null|-?(?:0|[1-9]\d*)(?:\.\d+)?(?:[eE][+-]?\d+)?)/',
                $this->text,
                $match,
                0,
                $this->pos
            ) !== 1
        ) {
            $this->fail();
        }
        $this->pos += strlen($match[0]);
        return json_decode($match[0], false, 1, JSON_THROW_ON_ERROR);
    }

    private function string(): string
    {
        $this->pos++;
        $out = '';
        while (true) {
            $run = strcspn(
                $this->text,
                "\"\\\x00\x01\x02\x03\x04\x05\x06\x07\x08\t\n\x0b\x0c\r\x0e\x0f"
                    . "\x10\x11\x12\x13\x14\x15\x16\x17\x18\x19\x1a\x1b\x1c\x1d\x1e\x1f",
                $this->pos
            );
            $out .= substr($this->text, $this->pos, $run);
            $this->pos += $run;
            $char = $this->text[$this->pos] ?? '';
            if ($char === '"') {
                $this->pos++;
                return $out;
            }
            if ($char !== '\\') {
                $this->fail();
            }
            $escape = $this->text[$this->pos + 1] ?? '';
            $this->pos += 2;
            $simple = [
                '"' => '"',
                '\\' => '\\',
                '/' => '/',
                'b' => "\x08",
                'f' => "\x0c",
                'n' => "\n",
                'r' => "\r",
                't' => "\t"
            ];
            if (isset($simple[$escape])) {
                $out .= $simple[$escape];
                continue;
            }
            if ($escape !== 'u') {
                $this->fail();
            }
            $unit = $this->hex();
            if ($unit >= 0xd800 && $unit < 0xdc00 && substr($this->text, $this->pos, 2) === '\\u') {
                $save = $this->pos;
                $this->pos += 2;
                $low = $this->hex();
                if ($low >= 0xdc00 && $low < 0xe000) {
                    $code = 0x10000 + (($unit - 0xd800) << 10) + ($low - 0xdc00);
                    $out .= chr(0xf0 | $code >> 18)
                        . chr(0x80 | $code >> 12 & 0x3f)
                        . chr(0x80 | $code >> 6 & 0x3f)
                        . chr(0x80 | $code & 0x3f);
                    continue;
                }
                $this->pos = $save;
            }
            $out .= self::encode($unit);
        }
    }

    private function hex(): int
    {
        $digits = substr($this->text, $this->pos, 4);
        if (preg_match('/\A[0-9A-Fa-f]{4}\z/', $digits) !== 1) {
            $this->fail();
        }
        $this->pos += 4;
        return hexdec($digits);
    }

    /** Encode a UTF-16 code unit, a surrogate included, in the UTF-8 bit layout. */
    private static function encode(int $unit): string
    {
        if ($unit < 0x80) {
            return chr($unit);
        }
        if ($unit < 0x800) {
            return chr(0xc0 | $unit >> 6) . chr(0x80 | $unit & 0x3f);
        }
        return chr(0xe0 | $unit >> 12) . chr(0x80 | $unit >> 6 & 0x3f) . chr(0x80 | $unit & 0x3f);
    }
}
