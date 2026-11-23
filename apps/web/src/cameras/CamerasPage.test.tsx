import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('./useHlsPlayer.js', () => ({
  useHlsPlayer: (_ref: unknown, _src: string, enabled: boolean) => ({
    state: enabled ? 'playing' : 'idle',
    error: null,
  }),
}));

import { CamerasPage, type CamerasResponse, cameraTag } from './CamerasPage.js';

function renderWith(body: CamerasResponse) {
  vi.stubGlobal(
    'fetch',
    vi.fn(async () => Response.json(body)),
  );
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={client}>
      <CamerasPage />
    </QueryClientProvider>,
  );
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('cameraTag', () => {
  it('always pairs a tone with a word', () => {
    expect(cameraTag('offline', 'idle')).toEqual({
      tone: 'err',
      word: 'offline',
    });
    expect(cameraTag('live', 'playing')).toEqual({ tone: 'ok', word: 'live' });
    expect(cameraTag('live', 'loading')).toEqual({
      tone: 'warn',
      word: 'connecting',
    });
    expect(cameraTag('live', 'error')).toEqual({ tone: 'err', word: 'err' });
    expect(cameraTag('unknown', 'loading')).toEqual({
      tone: 'warn',
      word: 'relay?',
    });
  });
});

describe('CamerasPage', () => {
  it('explains how to enable cameras when none are configured', async () => {
    renderWith({ enabled: false, cameras: [] });
    expect(await screen.findByText('No cameras configured')).toBeTruthy();
  });

  it('renders a tile per camera with its status word', async () => {
    renderWith({
      enabled: true,
      cameras: [
        {
          id: 'pi',
          label: 'Pi cam',
          status: 'live',
          tracks: ['H264'],
          playlist: '/api/cameras/pi/hls/index.m3u8',
        },
        {
          id: 'webcam',
          label: 'Desk webcam',
          status: 'offline',
          tracks: [],
          playlist: '/api/cameras/webcam/hls/index.m3u8',
        },
      ],
    });
    expect(await screen.findByRole('article', { name: 'Pi cam' })).toBeTruthy();
    expect(screen.getByText('live')).toBeTruthy();
    expect(screen.getByText('offline')).toBeTruthy();
    expect(screen.getByText(/No signal from/)).toBeTruthy();
    expect(screen.getByLabelText('Pi cam live view')).toBeTruthy();
  });
});
