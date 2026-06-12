import { defineConfig } from 'vitest/config';
import { coreCoverageOptions } from '../../vitest.coverage.js';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
    coverage: coreCoverageOptions(['src/markdown.ts']),
  },
});
