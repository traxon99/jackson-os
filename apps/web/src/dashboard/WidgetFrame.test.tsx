import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';

vi.mock('./useNow.js', () => ({
  useNow: () => new Date('2026-06-01T12:05:00.000Z'),
}));

import { WidgetFrame } from './WidgetFrame.js';

function ValueView({ data }: { data: { value: number } }) {
  return <p>{data.value}</p>;
}

function ValueLabelView({ data }: { data: { value: number } }) {
  return <p>Value: {data.value}</p>;
}

function LastValueView({ data }: { data: { value: number } }) {
  return <p>Last: {data.value}</p>;
}

describe('WidgetFrame', () => {
  it('shows a skeleton while loading without payload', () => {
    render(
      <WidgetFrame<{ value: number }>
        title="Test widget"
        isLoading
        onRetry={() => {}}
        View={ValueView}
      />,
    );

    expect(screen.getByText('Loading…')).toBeInTheDocument();
    expect(screen.queryByText('Not configured')).not.toBeInTheDocument();
  });

  it('renders ok data, fetched time, and stale badge', () => {
    render(
      <WidgetFrame<{ value: number }>
        title="Test widget"
        isLoading={false}
        onRetry={() => {}}
        payload={{
          state: 'ok',
          data: { value: 42 },
          fetchedAt: '2026-06-01T12:00:00.000Z',
          stale: true,
        }}
        View={ValueLabelView}
      />,
    );

    expect(screen.getByText('Value: 42')).toBeInTheDocument();
    expect(screen.getByText('stale')).toBeInTheDocument();
    expect(screen.getByText('5m ago')).toBeInTheDocument();
  });

  it('shows last good data under an error banner', async () => {
    const onRetry = vi.fn();
    const user = userEvent.setup();

    render(
      <WidgetFrame<{ value: number }>
        title="Test widget"
        isLoading={false}
        onRetry={onRetry}
        payload={{
          state: 'error',
          error: 'fetch failed',
          lastGood: {
            data: { value: 7 },
            fetchedAt: '2026-06-01T11:00:00.000Z',
          },
        }}
        View={LastValueView}
      />,
    );

    expect(screen.getByRole('alert')).toHaveTextContent('fetch failed');
    expect(screen.getByText('Last: 7')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Try again' }));
    expect(onRetry).toHaveBeenCalledOnce();
  });

  it('shows Not configured when disabled', () => {
    render(
      <WidgetFrame<never>
        title="Test widget"
        isLoading={false}
        onRetry={() => {}}
        payload={{ state: 'disabled' }}
        View={() => null}
      />,
    );

    expect(screen.getByText('Not configured')).toBeInTheDocument();
  });
});
