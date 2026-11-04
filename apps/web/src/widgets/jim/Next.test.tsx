import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { JimNextWidget } from './Next.js';

describe('JimNextWidget', () => {
  const full = {
    plan: {
      scheduled: [
        {
          date: '2026-11-04',
          routineId: 'r_push',
          routineName: 'Push A',
          exerciseCount: 6,
          programName: 'PPL',
          webUrl: 'https://jim.example.com/routines/r_push',
        },
        {
          date: '2026-11-06',
          routineId: 'r_pull',
          routineName: 'Pull B',
          exerciseCount: 5,
          programName: 'PPL',
          webUrl: 'https://jim.example.com/routines/r_pull',
        },
      ],
      next: {
        routineId: 'r_push',
        routineName: 'Push A',
        date: '2026-11-04',
        webUrl: 'https://jim.example.com/routines/r_push',
      },
    },
    dpr: {
      block: {
        name: 'Strength Block A',
        week: 3,
        weeks: 8,
        lifts: [
          {
            exerciseId: 'ex_squat',
            name: 'Squat',
            unit: 'lb',
            next: { weight: 275, reps: 5, intensity: 0.82 },
            e1rm: 335,
            goal: 350,
            lastDecision: 'progress',
          },
          {
            exerciseId: 'ex_bench',
            name: 'Bench Press',
            unit: 'lb',
            next: { weight: 185, reps: 5, intensity: 0.8 },
            e1rm: 230,
            goal: null,
            lastDecision: 'hold',
          },
        ],
      },
    },
  };

  it('renders full fixture with meters when goal is set', () => {
    render(<JimNextWidget.View data={full} />);

    expect(screen.getByRole('link', { name: 'Push A' })).toHaveAttribute(
      'href',
      'https://jim.example.com/routines/r_push',
    );
    expect(
      screen.getByText(/Strength Block A · week 3\/8/),
    ).toBeInTheDocument();
    expect(screen.getAllByRole('row')).toHaveLength(2);
    expect(screen.getByText(/Squat vs goal/)).toBeInTheDocument();
    expect(screen.queryByText(/Bench Press vs goal/)).not.toBeInTheDocument();
  });

  it('shows nothing planned when next is null', () => {
    render(
      <JimNextWidget.View
        data={{
          plan: { scheduled: [], next: null },
          dpr: full.dpr,
        }}
      />,
    );

    expect(screen.getByText('nothing planned')).toBeInTheDocument();
  });

  it('omits DPR rows when block is null', () => {
    render(
      <JimNextWidget.View
        data={{
          plan: full.plan,
          dpr: { block: null },
        }}
      />,
    );

    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });
});
