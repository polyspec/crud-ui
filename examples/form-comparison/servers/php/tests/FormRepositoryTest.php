<?php

declare(strict_types=1);

namespace Polyspec\Crudui\FormComparison\Tests;

use InvalidArgumentException;
use PHPUnit\Framework\TestCase;
use Polyspec\Crudui\FormComparison\FormJson;
use Polyspec\Crudui\FormComparison\FormRepository;
use stdClass;

/** FormRepository keeps positions, IDs and sequences, rejects inconsistent saves and never replaces invalid storage. */
final class FormRepositoryTest extends TestCase
{
    public function testSavesLoadsAndRejectsAsTheRepositoryContractRequires(): void
    {
        $file = sys_get_temp_dir() . '/crudui-repository-' . bin2hex(random_bytes(6)) . '.json';
        $repo = new FormRepository($file);
        try {
            $before = $repo->read();
            $data = self::saved(self::formData($before), false);
            $saved = $repo->save($data);
            self::assertTrue($saved['storage'] === $before, 'Save must preserve every loaded value and ID');
            $second = new FormRepository($file);
            self::assertTrue($second->read() === $before, 'A new repository instance must load the same file');
            $reversed = $before;
            foreach (['companies', 'stores', 'departments'] as $table) {
                $reversed[$table] = array_reverse($reversed[$table]);
            }
            self::assertTrue(
                FormJson::encode(self::formData($reversed)) === FormJson::encode(self::formData($before)),
                'Loading must use stored positions rather than physical record order'
            );

            $company = array_values($data['companies'])[0];
            $data['companies']['__abcdef0123456__'] = $company;
            $rejected = false;
            try {
                $repo->save($data);
            } catch (InvalidArgumentException) {
                $rejected = true;
            }
            self::assertTrue($rejected, 'An existing child cannot use another parent');
            self::assertTrue($repo->read() === $before, 'A rejected transaction must preserve the file');

            $repo->save(['companies' => []]);
            $empty = $repo->read();
            self::assertTrue($empty['companies'] === [] && $empty['stores'] === []
                && $empty['departments'] === [], 'Full deletion must remove descendants');
            self::assertTrue(
                $empty['next'] === $before['next'],
                'Full deletion must retain sequence counters'
            );
            $loaded = FormRepository::loadData($empty);
            self::assertTrue(
                $loaded['companies'] instanceof stdClass,
                'An empty JSON collection must remain an object'
            );

            $row = ['name' => 'New company', 'stores' => []];
            $insert = ['companies' => ['__abcdef0123456__' => $row]];
            $created = $repo->save(self::saved($insert, true));
            self::assertTrue(
                $created['storage']['companies'][0]['company_seq'] === '2',
                'A deleted sequence must not be reused'
            );
            self::assertTrue(
                $created['storage']['next']['company'] === 3,
                'The sequence counter must increase'
            );

            file_put_contents($file, '{invalid');
            $rejected = false;
            try {
                $repo->read();
            } catch (\Polyspec\Json\ParseError) {
                $rejected = true;
            }
            self::assertTrue(
                $rejected && file_get_contents($file) === '{invalid',
                'Invalid storage must not be replaced with seed data'
            );
        } finally {
            if (is_file($file)) {
                unlink($file);
            }
            if (is_file($file . '.lock')) {
                unlink($file . '.lock');
            }
        }
    }

    /** The loaded data of one state as the JSON save receives it. */
    private static function formData(array $state): stdClass
    {
        return FormJson::decode(FormJson::encode(FormRepository::loadData($state)));
    }

    /** The repository input of one submitted form. */
    private static function saved(mixed $form, bool $native): array
    {
        return FormJson::arrays(FormRepository::submission($form, $native));
    }
}
