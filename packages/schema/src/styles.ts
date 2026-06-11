export interface AutoLayout {
  direction: 'horizontal' | 'vertical';
  gap: number;
  padding: { top: number; right: number; bottom: number; left: number };
  alignItems: 'start' | 'center' | 'end';
  justifyContent: 'start' | 'center' | 'end' | 'space-between';
}
