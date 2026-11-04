export type DeltaKind =
  | { kind: 'new' }
  | { kind: 'same' }
  | { kind: 'up' | 'down'; pct: number };

export function computeDelta(
  current: number,
  previous: number | null | undefined,
): DeltaKind {
  if (
    previous === null ||
    previous === undefined ||
    (previous === 0 && current > 0)
  ) {
    return { kind: 'new' };
  }
  if (current === 0 && previous === 0) {
    return { kind: 'same' };
  }
  const pct = Math.round(((current - previous) / previous) * 100);
  if (pct === 0) {
    return { kind: 'same' };
  }
  if (pct > 0) {
    return { kind: 'up', pct };
  }
  return { kind: 'down', pct: Math.abs(pct) };
}
