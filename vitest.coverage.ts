import type { CoverageV8Options } from 'vitest/coverage-v8';

/** §13.1 核心纯函数模块 — CI 覆盖率报告范围 */
export const coreCoverageReporter = ['text', 'text-summary', 'lcov'] as const;

export function coreCoverageOptions(
  include: string[],
  thresholds?: CoverageV8Options['thresholds'],
): CoverageV8Options {
  return {
    provider: 'v8',
    reporter: [...coreCoverageReporter],
    include,
    thresholds,
  };
}
