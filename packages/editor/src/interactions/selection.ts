import type { ID } from '@rough/schema';

export class SelectionManager {
  selectedIds = new Set<ID>();
  private listeners = new Set<(ids: Set<ID>) => void>();

  select(ids: ID[]): void {
    this.selectedIds = new Set(ids);
    this.notify();
  }

  toggle(id: ID): void {
    if (this.selectedIds.has(id)) {
      this.selectedIds.delete(id);
    } else {
      this.selectedIds.add(id);
    }
    this.notify();
  }

  clear(): void {
    if (this.selectedIds.size === 0) return;
    this.selectedIds = new Set();
    this.notify();
  }

  isSelected(id: ID): boolean {
    return this.selectedIds.has(id);
  }

  getIds(): ID[] {
    return [...this.selectedIds];
  }

  subscribe(listener: (ids: Set<ID>) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private notify(): void {
    const copy = new Set(this.selectedIds);
    for (const l of this.listeners) l(copy);
  }
}
