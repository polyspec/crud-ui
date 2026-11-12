<?php

declare(strict_types=1);

namespace Polyspec\Crudui\Validator\Tests\Validate;

use PHPUnit\Framework\TestCase;
use Polyspec\Crudui\Validator\Compose\ComposeLoadError;
use Polyspec\Crudui\Validator\Validate\Validator as DataValidator;

final class ValidatorConstructionTest extends TestCase
{
    public function testTheValidatorChecksDeclarationsWhenConstructed(): void
    {
        $this->expectException(ComposeLoadError::class);
        $this->expectExceptionMessage('Invalid match pattern: unsupported construct at 0');
        new DataValidator([
            'type' => 'group',
            'properties' => ['a' => ['type' => 'text', 'validate' => ['match' => '(?i)a']]]
        ]);
    }
}
