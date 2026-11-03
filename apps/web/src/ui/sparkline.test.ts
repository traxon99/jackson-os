import { describe, expect, it } from 'vitest';
import { sparklinePoints } from './sparkline.js';

describe('sparklinePoints', () => {
  it('returns nothing for no values', () => {
    expect(sparklinePoints([], 60, 20)).toBe('');
  });

  it('draws a flat midline for a single value', () => {
    expect(sparklinePoints([5], 60, 20)).toBe('0,10 60,10');
  });

  it('maps min to the bottom and max to the top, keeping 1px inset', () => {
    expect(sparklinePoints([0, 10], 60, 20)).toBe('0,19 60,1');
  });

  it('spreads points evenly across the width', () => {
    expect(sparklinePoints([1, 2, 3], 100, 10)).toBe('0,9 50,5 100,1');
  });

  it('draws a flat line when all values are equal', () => {
    expect(sparklinePoints([4, 4, 4], 20, 10)).toBe('0,9 10,9 20,9');
  });
});
