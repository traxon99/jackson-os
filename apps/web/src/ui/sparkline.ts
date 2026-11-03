/**
 * Turns a list of values into SVG polyline points that fill a `width` x `height`
 * box. The lowest value sits on the bottom edge and the highest on the top,
 * with 1px kept free so the stroke is not clipped.
 */
export function sparklinePoints(
  values: readonly number[],
  width: number,
  height: number,
): string {
  if (values.length === 0) {
    return '';
  }
  if (values.length === 1) {
    const y = round(height / 2);
    return `0,${y} ${round(width)},${y}`;
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const step = width / (values.length - 1);
  const usable = height - 2;

  return values
    .map((value, index) => {
      const x = round(index * step);
      const y = round(height - 1 - ((value - min) / span) * usable);
      return `${x},${y}`;
    })
    .join(' ');
}

function round(n: number): number {
  return Math.round(n * 10) / 10;
}
