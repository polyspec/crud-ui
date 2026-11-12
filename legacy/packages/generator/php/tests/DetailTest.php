<?php

declare(strict_types=1);

namespace Polyspec\Crudui\Generator\Tests;

use Polyspec\Crudui\Generator;
use PHPUnit\Framework\TestCase;
use stdClass;

final class DetailTest extends TestCase
{
    public function testRendersReadOnlyDetailFromTheSharedListDisplayEngine(): void
    {
        $html = Generator::renderDetail(
            ['fields' => ['name' => ['field' => 'name', 'label' => 'Name']]],
            ['name' => 'Ada'],
        );
        self::assertSame(
            '<dl class="crudui-detail"><div class="crudui-detail__field"><dt class="crudui-detail__label">Name<'
                . '/dt><dd class="crudui-detail__value crudui-value crudui-value--text">Ada</dd></div></dl>',
            $html
        );
    }

    public function testBuildsTheReadOnlyDetailModel(): void
    {
        $model = Generator::buildDetail(
            ['fields' => ['name' => ['field' => 'name', 'label' => 'Name']]],
            ['name' => 'Ada'],
        );
        self::assertSame('Ada', $model->fields[0]->display);
    }

    public function testAcceptsNonEmptyAssociativeObjectDecodedByPhp(): void
    {
        $record = json_decode('{"name":"Ada"}', true, 512, JSON_THROW_ON_ERROR);

        $html = Generator::renderDetail(
            ['fields' => ['name' => ['field' => 'name', 'label' => 'Name']]],
            $record,
        );

        self::assertStringContainsString('>Ada</dd>', $html);
    }

    public function testAnEmptyArrayIsNoRecordAndAnEmptyObjectIs(): void
    {
        $emptyObject = json_decode('{}', false, 512, JSON_THROW_ON_ERROR);
        self::assertSame(
            '<dl class="crudui-detail"></dl>',
            Generator::renderDetail(['fields' => new stdClass()], $emptyObject)
        );
        // An associative decode of {} is the empty array, which is a list and so no object
        // (docs/spec/display-formats.md).
        $emptyArray = json_decode('{}', true, 512, JSON_THROW_ON_ERROR);
        $this->expectExceptionMessage('Detail record must be an object');
        Generator::renderDetail(['fields' => new stdClass()], $emptyArray);
    }

    public function testRejectsAssociativeDecodeOfASequentialNumericObject(): void
    {
        $object = json_decode('{"0":"Ada","1":"Grace"}', true, 512, JSON_THROW_ON_ERROR);

        self::assertTrue(array_is_list($object));
        $this->expectExceptionMessage('Detail record must be an object');
        Generator::renderDetail(['fields' => new stdClass()], $object);
    }

    public function testRejectsMissingFields(): void
    {
        $this->expectExceptionMessage('Detail specification must declare fields');
        Generator::renderDetail((object) [], ['name' => 'Ada']);
    }

    public function testRejectsAnEmptyArraySpecification(): void
    {
        $this->expectExceptionMessage('Detail specification must be an object');
        Generator::renderDetail([], ['name' => 'Ada']);
    }

    public function testRejectsListShapedSpecification(): void
    {
        $this->expectExceptionMessage('Detail specification must be an object');
        Generator::renderDetail([['field' => 'name']], ['name' => 'Ada']);
    }

    public function testRejectsListShapedRecord(): void
    {
        $this->expectExceptionMessage('Detail record must be an object');
        Generator::renderDetail(['fields' => new stdClass()], ['Ada']);
    }

    public function testOmittedRecordUsesAnEmptyObject(): void
    {
        $html = Generator::renderDetail(['fields' => new stdClass()]);
        self::assertSame('<dl class="crudui-detail"></dl>', $html);
    }
}
