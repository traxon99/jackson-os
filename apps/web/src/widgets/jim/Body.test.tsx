import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { JimBodyWidget } from './Body.js';

describe('JimBodyWidget', () => {
  it('renders the normal bodyweight fixture', () => {
    render(
      <JimBodyWidget.View
        data={{
          kinds: [
            {
              kind: 'bodyweight',
              latest: {
                value: 181.2,
                unit: 'lb',
                measuredAt: '2026-09-30T00:00:00.000Z',
              },
              change: -2.4,
              points: [
                { measuredAt: '2026-09-01T00:00:00.000Z', value: 180 },
                { measuredAt: '2026-09-30T00:00:00.000Z', value: 180.8 },
              ],
            },
          ],
        }}
      />,
    );

    expect(screen.getByText('bodyweight')).toBeInTheDocument();
    expect(
      screen.getByRole('img', { name: 'Bodyweight, 90 days' }),
    ).toBeInTheDocument();
    expect(screen.getByText('-2.4 lb / 90d')).toBeInTheDocument();
  });

  it('shows empty state when latest is null', () => {
    render(
      <JimBodyWidget.View
        data={{
          kinds: [
            {
              kind: 'bodyweight',
              latest: null,
              change: null,
              points: [],
            },
          ],
        }}
      />,
    );

    expect(screen.getByText('no measurements')).toBeInTheDocument();
  });

  it('renders negative change text', () => {
    render(
      <JimBodyWidget.View
        data={{
          kinds: [
            {
              kind: 'bodyweight',
              latest: {
                value: 180,
                unit: 'lb',
                measuredAt: '2026-06-01T00:00:00.000Z',
              },
              change: -1.4,
              points: [{ measuredAt: '2026-06-01T00:00:00.000Z', value: 180 }],
            },
          ],
        }}
      />,
    );

    expect(screen.getByText('-1.4 lb / 90d')).toBeInTheDocument();
  });
});
