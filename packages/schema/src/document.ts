import type { Element, ID, RGBA, SemanticTag } from './elements.js';

export interface RoughDocument {
  schemaVersion: number;
  id: ID;
  name: string;
  pages: Record<ID, Page>;
  pageOrder: ID[];
  components: Record<ID, ComponentDef>;
  assets: Record<ID, AssetRef>;
}

export interface Page {
  id: ID;
  name: string;
  elements: Record<ID, Element>;
  background: RGBA;
}

export interface ComponentDef {
  id: ID;
  name: string;
  description: string;
  rootId: ID;
  elements: Record<ID, Element>;
  semantic: SemanticTag | null;
}

export interface AssetRef {
  id: ID;
  mime: string;
  width: number;
  height: number;
  sha256: string;
}
