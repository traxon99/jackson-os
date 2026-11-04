import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { JimLiftsWidget } from './Lifts.js';

const series = [
  { date: '2026-06-01', e1rm: 250 },
  { date: '2026-06-02', e1rm: 252 },
];

describe('JimLiftsWidget', () => {
  it('renders sparklines for lifts with two or more points', () => {
    render(
      <JimLiftsWidget.View
        data={{
          selection: 'most_trained',
          lifts: ['Squat', 'Bench', 'Deadlift', 'OHP'].map((name, i) => ({
            exerciseId: `ex_${i}`,
            name,
            unit: 'lb',
            current: 300,
            best: 320,
            predicted: 310,
            series,
          })),
        }}
      />,
    );

    expect(screen.getAllByRole('img', { name: /e1RM, 90 days/i })).toHaveLength(
      4,
    );
  });

  it('shows dash when a lift has one point', () => {
    render(
      <JimLiftsWidget.View
        data={{
          selection: 'dpr',
          lifts: [
            {
              exerciseId: 'ex_squat',
              name: 'Squat',
              unit: 'lb',
              current: 300,
              best: 320,
              predicted: 310,
              series: [{ date: '2026-06-01', e1rm: 250 }],
            },
          ],
        }}
      />,
    );

    expect(screen.queryByRole('img')).not.toBeInTheDocument();
    expect(screen.getAllByText('–')).toHaveLength(1);
  });

  it('shows footer for each selection mode', () => {
    const { rerender } = render(
      <JimLiftsWidget.View data={{ selection: 'dpr', lifts: [] }} />,
    );
    expect(screen.getByText('picked by dpr')).toBeInTheDocument();

    rerender(
      <JimLiftsWidget.View data={{ selection: 'most_trained', lifts: [] }} />,
    );
    expect(screen.getByText('most trained')).toBeInTheDocument();

    rerender(
      <JimLiftsWidget.View data={{ selection: 'explicit', lifts: [] }} />,
    );
    expect(screen.getByText('your list')).toBeInTheDocument();
  });
});
