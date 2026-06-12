import { defineConfig } from 'vitest/config';
import { coreCoverageOptions } from '../../vitest.coverage.js';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    coverage: coreCoverageOptions(['src/fractionalIndex.ts'], {
      'src/fractionalIndex.ts': {
        lines: 90,
        functions: 90,
        branches: 90,
        statements: 90,
      },
    }),
  },
});
