import { describe, expect, it } from 'vitest';
import { UndoManager } from './UndoManager.js';
import type { Command } from './Command.js';

function makeCommand(label: string, log: string[]): Command {
  return {
    execute: () => log.push(`do:${label}`),
    undo: () => log.push(`undo:${label}`),
  };
}

describe('UndoManager', () => {
  it('supports at least 100 undo steps', () => {
    const undo = new UndoManager();
    const log: string[] = [];
    for (let i = 0; i < 100; i++) {
      undo.execute(makeCommand(String(i), log));
    }
    expect(undo.canUndo()).toBe(true);
    for (let i = 0; i < 100; i++) {
      expect(undo.undo()).toBe(true);
    }
    expect(undo.canUndo()).toBe(false);
    expect(log.filter((x) => x.startsWith('undo:')).length).toBe(100);
  });
});
