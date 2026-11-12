<?php

declare(strict_types=1);

namespace Polyspec\Crudui\Validator\Expr;

/**
 * Token type tags (expressions.md §1, JS types.ts TokenType parity).
 *
 * String-backed so a fixture's token.type string ("DOT"|"IDENTIFIER"|...) maps
 * directly. WHITESPACE never reaches the token array (the lexer drops it); EOF
 * is always the final token. INVALID is one unrecognized character.
 *
 * Intentionally absent (GRAMMAR §1·§10): arithmetic + - * / %, function calls,
 * method calls, regex, assignment =, bitwise, root path /. Do not add them.
 */
enum TokenType: string
{
    case STRING     = 'STRING';
    case NUMBER     = 'NUMBER';
    case BOOLEAN    = 'BOOLEAN';
    case NULL       = 'NULL';

    case IDENTIFIER = 'IDENTIFIER';
    case DOT        = 'DOT';
    case DOT_DOT    = 'DOT_DOT';
    case ASTERISK   = 'ASTERISK';

    case EQ = 'EQ';
    case NE = 'NE';
    case GT = 'GT';
    case GE = 'GE';
    case LT = 'LT';
    case LE = 'LE';

    case AND = 'AND';
    case OR  = 'OR';
    case NOT = 'NOT';

    case IN     = 'IN';
    case NOT_IN = 'NOT_IN';

    case LPAREN   = 'LPAREN';
    case RPAREN   = 'RPAREN';
    case LBRACKET = 'LBRACKET';
    case RBRACKET = 'RBRACKET';
    case COMMA    = 'COMMA';

    case QUESTION = 'QUESTION';
    case COLON    = 'COLON';

    case EOF        = 'EOF';
    case WHITESPACE = 'WHITESPACE';
    case INVALID    = 'INVALID';
}
