<?php

declare(strict_types=1);

namespace Polyspec\Crudui\Generator\Tests;

use PHPUnit\Framework\TestCase;
use Polyspec\Crudui\Form;
use Polyspec\Crudui\Generator;
use PHPUnit\Framework\Attributes\DataProvider;

final class DatesTest extends TestCase
{
    public static function dates(): array
    {
        return [
            'date' => ['2026-09-09', '2026-09-09', '2026-09-09T00:00:00'],
            'UTC datetime' => ['2026-09-09T00:30', '2026-09-09', '2026-09-09T00:30:00'],
            'previous UTC date' => ['2026-09-09T00:30:45+09:00', '2026-09-08', '2026-09-08T15:30:45'],
            'next UTC date' => ['2026-09-09 23:30-07:00', '2026-09-10', '2026-09-10T06:30:00'],
            'fractional seconds' => ['2026-09-09T00:30:45.987654321Z', '2026-09-09', '2026-09-09T00:30:45'],
            'Gregorian leap day' => ['2000-02-29', '2000-02-29', '2000-02-29T00:00:00'],
            'year zero' => ['0000-02-29', '0000-02-29', '0000-02-29T00:00:00'],
            'negative UTC year' => ['0000-01-01T00:00+00:01', '-0001-12-31', '-0001-12-31T23:59:00'],
            'five-digit UTC year' => ['9999-12-31T23:59-00:01', '10000-01-01', '10000-01-01T00:00:00'],
            'RFC numeric zone' => ['Wed, 09 Sep 2026 00:30:45 +0900', '2026-09-08', '2026-09-08T15:30:45'],
            'RFC named zone' => ['wed, 9 sep 2026 23:30 PDT', '2026-09-10', '2026-09-10T06:30:00'],
            'RFC no weekday' => ["9\tSep 2026 00:30 GMT", '2026-09-09', '2026-09-09T00:30:00'],
        ];
    }

    #[DataProvider('dates')]
    public function testControlsAndListsUseUtcAndPreserveSuppliedData(
        string $input,
        string $date,
        string $datetime
    ): void {
        $this->assertRenderedValues($input, $date, $datetime);
    }

    public static function invalidDates(): array
    {
        return array_map(static fn (string $value): array => [$value], [
            '', 'today', '09/09/2026', ' 2026-09-09', "2026-09-09\n",
            '1900-02-29', '2026-02-30', '2026-09-09T24:00',
            '2026-09-09T00:60', '2026-09-09T00:00:60',
            '2026-09-09T00:30+24:00', '2026-09-09T00:30+09:60',
            '2026-09-09T00:30.5Z', '2026-09-09T00:30Z trailing',
            'Thu, 09 Sep 2026 00:30 GMT', '09 Sep 2026 00:30',
            '09 Sep 26 00:30 GMT', '09 Sep 2026 00:30 A',
            '09 Sep 2026 00:30 GMT (UTC)', "09 Sep 2026\r\n 00:30 GMT",
        ]);
    }

    #[DataProvider('invalidDates')]
    public function testInvalidAndUnsupportedDatesRemainUnchanged(string $input): void
    {
        $this->assertRenderedValues($input, $input, $input);
    }

    private function assertRenderedValues(string $input, string $date, string $datetime): void
    {
        $spec = json_decode('{"type":"group","properties":{"date":{"type":"date"},"datetime":{"type":"datetime"}}}');
        $template = Generator::compileForm($spec);
        $listSpec = json_decode(
            '{"columns":{"value":{"field":"value","format":{"type":"date","pattern":"YYYY-MM-DDTHH:mm:ss"}}}}'
        );
        $data = (object) ['date' => $input, 'datetime' => $input];
        $previousTimezone = date_default_timezone_get();
        $expectedHtml = null;
        try {
            foreach (['UTC', 'Asia/Seoul', 'America/Los_Angeles'] as $timezone) {
                date_default_timezone_set($timezone);
                $initial = new Form($template, $data);
                $injected = new Form($template);
                $injected->setData($data);
                self::assertSame($date, $initial->getFields()[0]->widget->attrs->value);
                self::assertSame($datetime, $initial->getFields()[1]->widget->attrs->value);
                self::assertSame(json_encode($data), json_encode($initial->getData()));
                self::assertSame(json_encode($initial->getFields()), json_encode($injected->getFields()));
                $html = Generator::renderForm($initial);
                self::assertSame($html, Generator::renderForm($injected));
                $injected->setData($data);
                self::assertSame($html, Generator::renderForm($injected));
                $expectedHtml ??= $html;
                self::assertSame($expectedHtml, $html);
                $escaped = htmlspecialchars($datetime, ENT_QUOTES | ENT_SUBSTITUTE | ENT_HTML5, 'UTF-8');
                self::assertSame(
                    '<div class="crudui-list"><table class="crudui-list__table"><thead><tr><th class="crudui-li'
                        . 'st__heading" data-field="value"><span class="crudui-list__heading-label">value</span></th>'
                        . '</tr></thead><tbody><tr><td class="crudui-list__cell crudui-value crudui-value--date">'
                        . $escaped
                        . '</td></tr></tbody></table></div>',
                    Generator::renderList($listSpec, [(object) ['value' => $input]])
                );
            }
        } finally {
            date_default_timezone_set($previousTimezone);
        }
    }
}
