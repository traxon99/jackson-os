import { beforeAll, describe, expect, it, vi } from 'vitest';
import { createApp } from '../app.js';
import type { Session } from '../middleware/auth-gate.js';
import { tempWebDist } from '../test-helpers.js';
import {
  type CamerasConfig,
  type CamerasResponse,
  isSafeHlsPath,
  parseCameras,
} from './cameras.js';

const fullSession: Session = { id: 's1', scope: 'full' };

let webDist = '';
beforeAll(async () => {
  webDist = await tempWebDist();
});

function appWith(
  cameras: CamerasConfig | undefined,
  session: Session | null = fullSession,
) {
  return createApp({
    WEB_DIST: webDist,
    getSession: async () => session,
    cameras,
  });
}

function fakeRelay(routes: Record<string, () => Response>) {
  const calls: string[] = [];
  const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
    const url = String(input);
    calls.push(url);
    const handler = routes[url];
    if (handler === undefined) {
      return new Response('not found', { status: 404 });
    }
    return handler();
  }) as unknown as typeof fetch;
  return { fetchImpl, calls };
}

describe('parseCameras', () => {
  it('parses id=label pairs and trims', () => {
    expect(parseCameras(' pi=Pi cam , webcam=Desk ,')).toEqual([
      { id: 'pi', label: 'Pi cam' },
      { id: 'webcam', label: 'Desk' },
    ]);
  });

  it('uses the id as label when none is given', () => {
    expect(parseCameras('garage')).toEqual([{ id: 'garage', label: 'garage' }]);
  });

  it('returns nothing for empty input', () => {
    expect(parseCameras(undefined)).toEqual([]);
    expect(parseCameras('  ')).toEqual([]);
  });

  it('rejects unsafe or duplicate ids', () => {
    expect(() => parseCameras('../etc=x')).toThrow(/invalid camera id/);
    expect(() => parseCameras('Pi=x')).toThrow(/invalid camera id/);
    expect(() => parseCameras('pi=a,pi=b')).toThrow(/duplicate/);
  });
});

describe('isSafeHlsPath', () => {
  it('accepts MediaMTX file names', () => {
    expect(isSafeHlsPath('index.m3u8')).toBe(true);
    expect(isSafeHlsPath('video1_stream.m3u8')).toBe(true);
    expect(isSafeHlsPath('9a1b_video1_seg12.mp4')).toBe(true);
  });

  it('rejects traversal and odd segments', () => {
    expect(isSafeHlsPath('')).toBe(false);
    expect(isSafeHlsPath('..')).toBe(false);
    expect(isSafeHlsPath('../pi/index.m3u8')).toBe(false);
    expect(isSafeHlsPath('.hidden')).toBe(false);
    expect(isSafeHlsPath('a//b')).toBe(false);
    expect(isSafeHlsPath('a%2fb')).toBe(false);
  });
});

describe('GET /api/cameras', () => {
  it('requires a session', async () => {
    const app = appWith(undefined, null);
    const response = await app.request('/api/cameras');
    expect(response.status).toBe(401);
  });

  it('rejects recovery-scoped sessions', async () => {
    const app = appWith(undefined, { id: 'r', scope: 'recovery' });
    const response = await app.request('/api/cameras');
    expect(response.status).toBe(403);
  });

  it('reports disabled when no cameras are configured', async () => {
    const response = await appWith(undefined).request('/api/cameras');
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ enabled: false, cameras: [] });
  });

  it('merges relay path status into the camera list', async () => {
    const relay = fakeRelay({
      'http://mtx:9997/v3/paths/list?itemsPerPage=100': () =>
        Response.json({
          items: [
            { name: 'pi', online: true, tracks: ['H264'] },
            { name: 'webcam', ready: false, tracks: [] },
          ],
        }),
    });
    const app = appWith({
      cameras: [
        { id: 'pi', label: 'Pi cam' },
        { id: 'webcam', label: 'Desk' },
        { id: 'garage', label: 'Garage' },
      ],
      hlsUrl: 'http://mtx:8888',
      apiUrl: 'http://mtx:9997',
      fetchImpl: relay.fetchImpl,
    });

    const response = await app.request('/api/cameras');
    expect(response.status).toBe(200);
    const body = (await response.json()) as CamerasResponse;
    expect(body.enabled).toBe(true);
    expect(body.cameras).toEqual([
      {
        id: 'pi',
        label: 'Pi cam',
        status: 'live',
        tracks: ['H264'],
        playlist: '/api/cameras/pi/hls/index.m3u8',
      },
      {
        id: 'webcam',
        label: 'Desk',
        status: 'offline',
        tracks: [],
        playlist: '/api/cameras/webcam/hls/index.m3u8',
      },
      {
        id: 'garage',
        label: 'Garage',
        status: 'offline',
        tracks: [],
        playlist: '/api/cameras/garage/hls/index.m3u8',
      },
    ]);
  });

  it('reports unknown status when the relay API is down', async () => {
    const fetchImpl = vi.fn(async () => {
      throw new Error('ECONNREFUSED');
    }) as unknown as typeof fetch;
    const app = appWith({
      cameras: [{ id: 'pi', label: 'Pi' }],
      hlsUrl: 'http://mtx:8888',
      apiUrl: 'http://mtx:9997',
      fetchImpl,
    });
    const body = (await (
      await app.request('/api/cameras')
    ).json()) as CamerasResponse;
    expect(body.cameras[0]?.status).toBe('unknown');
  });
});

describe('GET /api/cameras/:id/hls/*', () => {
  const playlist = '#EXTM3U\n#EXT-X-VERSION:9\n';

  function configured(relay: ReturnType<typeof fakeRelay>): CamerasConfig {
    return {
      cameras: [{ id: 'pi', label: 'Pi' }],
      hlsUrl: 'http://mtx:8888/',
      fetchImpl: relay.fetchImpl,
    };
  }

  it('requires a session and never touches the relay without one', async () => {
    const relay = fakeRelay({});
    const app = appWith(configured(relay), null);
    const response = await app.request('/api/cameras/pi/hls/index.m3u8');
    expect(response.status).toBe(401);
    expect(relay.calls).toEqual([]);
  });

  it('proxies the playlist from the relay without caching', async () => {
    const relay = fakeRelay({
      'http://mtx:8888/pi/index.m3u8': () =>
        new Response(playlist, {
          headers: {
            'content-type': 'application/vnd.apple.mpegurl',
            'set-cookie': 'leak=1',
          },
        }),
    });
    const app = appWith(configured(relay));
    const response = await app.request('/api/cameras/pi/hls/index.m3u8');
    expect(response.status).toBe(200);
    expect(await response.text()).toBe(playlist);
    expect(response.headers.get('content-type')).toBe(
      'application/vnd.apple.mpegurl',
    );
    expect(response.headers.get('cache-control')).toBe('private, no-store');
    expect(response.headers.get('set-cookie')).toBeNull();
  });

  it('forwards only LL-HLS query params', async () => {
    const relay = fakeRelay({
      'http://mtx:8888/pi/video1_stream.m3u8?_HLS_msn=4&_HLS_part=1': () =>
        new Response(playlist),
    });
    const app = appWith(configured(relay));
    const response = await app.request(
      '/api/cameras/pi/hls/video1_stream.m3u8?_HLS_msn=4&evil=1&_HLS_part=1',
    );
    expect(response.status).toBe(200);
    expect(relay.calls).toEqual([
      'http://mtx:8888/pi/video1_stream.m3u8?_HLS_msn=4&_HLS_part=1',
    ]);
  });

  it('404s unknown cameras and unsafe paths without calling the relay', async () => {
    const relay = fakeRelay({});
    const app = appWith(configured(relay));
    for (const path of [
      '/api/cameras/garage/hls/index.m3u8',
      '/api/cameras/pi/hls/..%2F..%2Fv3%2Fpaths%2Flist',
      '/api/cameras/pi/hls/.env',
    ]) {
      const response = await app.request(path);
      expect(response.status, path).toBe(404);
    }
    expect(relay.calls).toEqual([]);
  });

  it('404s when cameras are not configured', async () => {
    const response = await appWith(undefined).request(
      '/api/cameras/pi/hls/index.m3u8',
    );
    expect(response.status).toBe(404);
  });

  it('maps relay failures to 404 or 502', async () => {
    const down = appWith({
      cameras: [{ id: 'pi', label: 'Pi' }],
      hlsUrl: 'http://mtx:8888',
      fetchImpl: (async () => {
        throw new Error('down');
      }) as unknown as typeof fetch,
    });
    expect((await down.request('/api/cameras/pi/hls/index.m3u8')).status).toBe(
      502,
    );

    const missing = appWith(configured(fakeRelay({})));
    expect(
      (await missing.request('/api/cameras/pi/hls/index.m3u8')).status,
    ).toBe(404);
  });
});
