import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { JimWeekWidget } from './Week.js';

const streak = {
  weeks: 6,
  target: 3,
  thisWeek: { done: 2, target: 3 },
  longest: 11,
};

describe('JimWeekWidget', () => {
  it('shows deltas for a normal week', () => {
    render(
      <JimWeekWidget.View
        data={{
          streak,
          weeks: [
            {
              weekStart: '2026-10-27',
              workouts: 4,
              workingSets: 48,
              volume: 42500,
              durationMinutes: 215,
              muscles: [],
              topExercises: [],
            },
            {
              weekStart: '2026-10-20',
              workouts: 3,
              workingSets: 36,
              volume: 30000,
              durationMinutes: 180,
              muscles: [],
              topExercises: [],
            },
          ],
        }}
      />,
    );

    expect(screen.getAllByText('▲ 33%').length).toBeGreaterThan(0);
  });

  it('shows rest week instead of muscle rows', () => {
    render(
      <JimWeekWidget.View
        data={{
          streak,
          weeks: [
            {
              weekStart: '2026-10-27',
              workouts: 0,
              workingSets: 0,
              volume: 0,
              durationMinutes: 0,
              muscles: [],
              topExercises: [],
            },
          ],
        }}
      />,
    );

    expect(screen.getByText('rest week')).toBeInTheDocument();
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('shows new when previous week is missing', () => {
    render(
      <JimWeekWidget.View
        data={{
          streak,
          weeks: [
            {
              weekStart: '2026-10-27',
              workouts: 4,
              workingSets: 48,
              volume: 42500,
              durationMinutes: 215,
              muscles: [],
              topExercises: [],
            },
          ],
        }}
      />,
    );

    expect(screen.getAllByText('new')).toHaveLength(3);
  });

  it('sorts muscles under before within before over', () => {
    render(
      <JimWeekWidget.View
        data={{
          streak,
          weeks: [
            {
              weekStart: '2026-10-27',
              workouts: 4,
              workingSets: 48,
              volume: 42500,
              durationMinutes: 215,
              muscles: [
                {
                  muscle: 'over-muscle',
                  sets: 20,
                  target: { low: 10, high: 12 },
                  status: 'over',
                },
                {
                  muscle: 'under-muscle',
                  sets: 4,
                  target: { low: 10, high: 16 },
                  status: 'under',
                },
                {
                  muscle: 'within-muscle',
                  sets: 12,
                  target: { low: 10, high: 16 },
                  status: 'within',
                },
              ],
              topExercises: [],
            },
          ],
        }}
      />,
    );

    const rows = screen.getAllByRole('row');
    expect(rows[0]).toHaveTextContent('under-muscle');
    expect(rows[1]).toHaveTextContent('within-muscle');
    expect(rows[2]).toHaveTextContent('over-muscle');
  });
});
