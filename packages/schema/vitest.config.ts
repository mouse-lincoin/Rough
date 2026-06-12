import { defineConfig } from 'vitest/config';
import { coreCoverageOptions } from '../../vitest.coverage.js';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    coverage: coreCoverageOptions(['src/version.ts']),
  },
});
