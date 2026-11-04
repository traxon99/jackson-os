import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { JimPrsWidget } from './Prs.js';

describe('JimPrsWidget', () => {
  it('shows new for a first PR', () => {
    render(
      <JimPrsWidget.View
        data={{
          prs: [
            {
              exerciseId: 'ex_squat',
              exerciseName: 'Squat',
              kind: 'e1rm',
              value: 315,
              unit: 'lb',
              previousValue: null,
              achievedAt: '2026-10-15T12:00:00Z',
              workoutId: 'w0',
            },
          ],
        }}
      />,
    );

    expect(screen.getByText('new')).toBeInTheDocument();
  });

  it('shows tier tag when set', () => {
    render(
      <JimPrsWidget.View
        data={{
          prs: [
            {
              exerciseId: 'ex_bench',
              exerciseName: 'Bench Press',
              kind: 'e1rm',
              value: 225,
              unit: 'lb',
              previousValue: 220,
              achievedAt: '2026-11-03T19:00:00Z',
              workoutId: 'w1',
              tier: 'intermediate',
            },
          ],
        }}
      />,
    );

    expect(screen.getByText('intermediate')).toBeInTheDocument();
  });

  it('shows empty state', () => {
    render(<JimPrsWidget.View data={{ prs: [] }} />);
    expect(screen.getByText('no prs in 30 days')).toBeInTheDocument();
  });
});
