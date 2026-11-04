import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { JimBackendWidget } from './Backend.js';

const backend = {
  checkedAt: '2026-11-04T06:48:00Z',
  services: [
    {
      id: 'vercel' as const,
      label: 'Vercel',
      status: 'operational' as const,
      checkedAt: '2026-11-04T06:48:00Z',
      deployment: {
        url: 'https://jim.example.com',
        environment: 'production' as const,
        state: 'READY' as const,
        commitSha: 'a1b2c3d4e5f6789012345678901234567890abcd',
        createdAt: '2026-11-04T05:12:33Z',
      },
      cron: {
        enabled: true,
        jobs: [{ path: '/api/cron/tick', schedule: '*/5 * * * *' }],
      },
    },
    {
      id: 'supabase' as const,
      label: 'Supabase',
      status: 'degraded' as const,
      checkedAt: '2026-11-04T06:47:55Z',
      project: {
        ref: 'abc',
        region: 'us-east-1',
        status: 'ACTIVE_HEALTHY' as const,
      },
      database: {
        postgresVersion: '15.8',
        pooler: 'transaction' as const,
      },
    },
    {
      id: 'cloudflare' as const,
      label: 'Cloudflare',
      status: 'operational' as const,
      checkedAt: '2026-11-04T06:47:50Z',
      zone: {
        name: 'example.com',
        status: 'active' as const,
        ssl: 'full_strict' as const,
        proxied: true,
      },
      analytics: {
        requests24h: 12840,
        uniqueVisitors24h: 312,
        bytes24h: 943718400,
      },
    },
    {
      id: 'fly' as const,
      label: 'Fly.io',
      status: 'down' as const,
      checkedAt: '2026-11-04T06:47:58Z',
      app: 'jim-mcp',
      region: 'iad',
      machines: { total: 1, started: 0 },
      healthCheck: { path: '/healthz', passing: false },
    },
  ],
};

describe('JimBackendWidget', () => {
  it('lists each provider with status words', () => {
    render(<JimBackendWidget.View data={backend} />);
    expect(screen.getAllByText('OK')).toHaveLength(2);
    expect(screen.getByText('WARN')).toBeInTheDocument();
    expect(screen.getByText('ERR')).toBeInTheDocument();
    expect(screen.getByText('vercel')).toBeInTheDocument();
    expect(screen.getByText('supabase')).toBeInTheDocument();
    expect(screen.getByText('cloudflare')).toBeInTheDocument();
    expect(screen.getByText(/jim-mcp iad/)).toBeInTheDocument();
  });

  it('links Vercel deployment url', () => {
    render(<JimBackendWidget.View data={backend} />);
    const link = screen.getByRole('link');
    expect(link).toHaveAttribute('href', 'https://jim.example.com');
  });
});
