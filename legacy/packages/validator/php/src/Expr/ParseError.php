<?php

declare(strict_types=1);

namespace Polyspec\Crudui\Validator\Expr;

/**
 * Raised by Lexer/Parser on malformed input. Carries the human message only;
 * the cross-language contract compares tokens/AST/values for VALID expressions,
 * so error position detail is intentionally not part of the fixture surface.
 */
final class ParseError extends \RuntimeException
{
}
