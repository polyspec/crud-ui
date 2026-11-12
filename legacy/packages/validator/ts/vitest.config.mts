import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    include: ['src/**/*.{test,spec}.{ts,tsx}'],
    // The typecheck mode checks the type assertions of src/**/*.test-d.ts with tsc and tsconfig.json, which includes
    // them; a runtime run does not evaluate expectTypeOf.
    typecheck: { enabled: true },
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      exclude: ['node_modules/', 'dist/', '**/*.test.ts', '**/*.spec.ts']
    }
  },
});
