import { describe, expect, it } from 'vitest';
import { canWrite } from './access.js';

describe('canWrite', () => {
  it('allows owner and edit modes', () => {
    expect(canWrite('owner')).toBe(true);
    expect(canWrite('edit')).toBe(true);
  });

  it('denies view and none', () => {
    expect(canWrite('view')).toBe(false);
    expect(canWrite('none')).toBe(false);
  });
});
