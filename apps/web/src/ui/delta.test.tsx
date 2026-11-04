import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { computeDelta } from './delta.js';
import { Delta } from './primitives.js';

describe('computeDelta', () => {
  it.each([
    { current: 5, previous: null, expected: { kind: 'new' } },
    { current: 5, previous: undefined, expected: { kind: 'new' } },
    { current: 5, previous: 0, expected: { kind: 'new' } },
    { current: 0, previous: 0, expected: { kind: 'same' } },
    { current: 12, previous: 10, expected: { kind: 'up', pct: 20 } },
    { current: 9, previous: 10, expected: { kind: 'down', pct: 10 } },
    { current: 10, previous: 9.96, expected: { kind: 'same' } },
    { current: 10, previous: 10, expected: { kind: 'same' } },
  ] as const)(
    'current=$current previous=$previous',
    ({ current, previous, expected }) => {
      expect(computeDelta(current, previous)).toEqual(expected);
    },
  );
});

describe('Delta', () => {
  it('uses ok tone when goodWhen is down and value decreased', () => {
    render(<Delta current={9} previous={10} goodWhen="down" />);
    const el = screen.getByText('▼ 10%');
    expect(el.className).toContain('t-ok');
  });
});
