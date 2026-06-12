import { defineConfig } from 'vitest/config';
import { coreCoverageOptions } from '../../vitest.coverage.js';

export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    environment: 'node',
    coverage: coreCoverageOptions(
      [
        'src/scene/transforms.ts',
        'src/scene/bounds.ts',
        'src/interactions/hitTest.ts',
        'src/interactions/snapping.ts',
        'src/layout/autoLayout.ts',
      ],
      {
        'src/interactions/hitTest.ts': {
          lines: 90,
          functions: 90,
          branches: 85,
          statements: 90,
        },
        'src/scene/transforms.ts': {
          lines: 90,
          functions: 90,
          branches: 80,
          statements: 90,
        },
      },
    ),
  },
});
