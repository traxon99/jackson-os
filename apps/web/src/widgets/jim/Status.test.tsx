import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { JimStatusWidget } from './Status.js';

const user = {
  username: 'jackson',
  units: 'lb' as const,
  weekStart: 1,
  timeZone: 'America/Chicago',
};

describe('JimStatusWidget', () => {
  it('shows synced 2h ago without stale tag', () => {
    render(
      <JimStatusWidget.View
        data={{
          user,
          lastSyncedAt: '2026-06-01T10:05:00.000Z',
          activeWorkout: null,
          tokenScope: 'read',
        }}
      />,
    );

    expect(screen.getByText(/synced 2h ago/i)).toBeInTheDocument();
    expect(screen.queryByText('stale sync')).not.toBeInTheDocument();
  });

  it('shows stale sync after 30h', () => {
    render(
      <JimStatusWidget.View
        data={{
          user,
          lastSyncedAt: '2026-05-30T06:05:00.000Z',
          activeWorkout: null,
          tokenScope: 'read',
        }}
      />,
    );

    expect(screen.getByText('stale sync')).toBeInTheDocument();
  });

  it('shows never synced', () => {
    render(
      <JimStatusWidget.View
        data={{
          user,
          lastSyncedAt: null,
          activeWorkout: null,
          tokenScope: 'read',
        }}
      />,
    );

    expect(screen.getByText('never synced')).toBeInTheDocument();
  });

  it('shows active workout with training tag', () => {
    render(
      <JimStatusWidget.View
        data={{
          user,
          lastSyncedAt: '2026-06-01T10:05:00.000Z',
          activeWorkout: {
            id: 'sess_1',
            name: 'Push A',
            startedAt: '2026-06-01T11:33:00.000Z',
          },
          tokenScope: 'read',
        }}
      />,
    );

    expect(screen.getByText('training')).toBeInTheDocument();
    expect(screen.getByText(/Push A · 32m ago/)).toBeInTheDocument();
  });
});
