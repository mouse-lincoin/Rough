import { defineWorkspace } from 'vitest/config';

export default defineWorkspace([
  'packages/schema',
  'packages/shared',
  'packages/document',
  'packages/editor',
  'packages/export',
  'packages/wireframe-kit',
  'apps/web',
  'apps/server',
]);
