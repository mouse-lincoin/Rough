export const AWARENESS_COLORS = [
  '#6965DB',
  '#FF6B6B',
  '#4ECDC4',
  '#FFE66D',
  '#95E1D3',
  '#F38181',
  '#AA96DA',
  '#FCBAD3',
] as const;

export function awarenessColorForClient(clientId: number): string {
  return AWARENESS_COLORS[clientId % AWARENESS_COLORS.length]!;
}

export interface AwarenessUserState {
  user: { id: string; name: string; color: string };
  cursor: { x: number; y: number } | null;
  selection: string[];
  viewport: { offset: { x: number; y: number }; zoom: number };
  pageId: string;
}
