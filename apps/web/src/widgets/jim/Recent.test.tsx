import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { JimRecentWidget } from './Recent.js';

const workouts = [
  {
    id: 'w1',
    name: 'Push A',
    routineName: 'PPL Push',
    startedAt: '2026-11-03T18:00:00Z',
    endedAt: '2026-11-03T19:15:00Z',
    durationMinutes: 75,
    exerciseCount: 6,
    workingSets: 18,
    volume: 18500,
    prCount: 2,
    gym: 'Home Gym',
    webUrl: 'https://jim.example.com/history/w1',
  },
  {
    id: 'w2',
    name: 'Legs',
    routineName: null,
    startedAt: '2026-11-01T12:00:00Z',
    endedAt: '2026-11-01T13:30:00Z',
    durationMinutes: 90,
    exerciseCount: 5,
    workingSets: 15,
    volume: 22000,
    prCount: 0,
    gym: null,
    webUrl: 'https://jim.example.com/history/w2',
  },
  {
    id: 'w3',
    name: 'Pull B',
    routineName: 'PPL Pull',
    startedAt: '2026-10-30T17:00:00Z',
    endedAt: '2026-10-30T18:05:00Z',
    durationMinutes: 65,
    exerciseCount: 5,
    workingSets: 16,
    volume: 16000,
    prCount: 1,
    gym: 'Commercial Gym',
    webUrl: 'https://jim.example.com/history/w3',
  },
];

describe('JimRecentWidget', () => {
  it('renders three rows', () => {
    render(<JimRecentWidget.View data={{ workouts }} />);
    expect(screen.getAllByRole('row')).toHaveLength(3);
  });

  it('shows pr tag only on workouts with prs', () => {
    render(<JimRecentWidget.View data={{ workouts }} />);
    expect(screen.getByText('2 pr')).toBeInTheDocument();
    expect(screen.getByText('1 pr')).toBeInTheDocument();
  });

  it('links the workout name to webUrl', () => {
    render(<JimRecentWidget.View data={{ workouts }} />);
    expect(screen.getByRole('link', { name: 'Push A' })).toHaveAttribute(
      'href',
      'https://jim.example.com/history/w1',
    );
  });

  it('shows empty state', () => {
    render(<JimRecentWidget.View data={{ workouts: [] }} />);
    expect(screen.getByText('no workouts yet')).toBeInTheDocument();
  });
});
