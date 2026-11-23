import { Hono } from 'hono';

/**
 * Live camera streams. The streams themselves come from a MediaMTX relay
 * that runs next to the app in Docker Compose (see docs/CAMERAS.md). MediaMTX
 * publishes no host ports: the browser only ever talks to these routes, which
 * sit behind the normal session gate, and the server proxies HLS from the
 * relay on the private Compose network.
 */

export type Camera = { id: string; label: string };

export type CamerasConfig = {
  cameras: Camera[];
  /** HLS base URL of the relay, e.g. `http://mediamtx:8888`. */
  hlsUrl: string;
  /** Control API base URL of the relay, e.g. `http://mediamtx:9997`. */
  apiUrl?: string;
  fetchImpl?: typeof fetch;
};

export type CameraStatus = 'live' | 'offline' | 'unknown';

export type CameraListItem = Camera & {
  status: CameraStatus;
  tracks: string[];
  playlist: string;
};

export type CamerasResponse = {
  enabled: boolean;
  cameras: CameraListItem[];
};

const CAMERA_ID = /^[a-z0-9][a-z0-9_-]{0,31}$/;
const FILE_SEGMENT = /^[A-Za-z0-9_-][A-Za-z0-9_.-]{0,127}$/;
const PROXY_TIMEOUT_MS = 15_000;
const STATUS_TIMEOUT_MS = 2_000;

/**
 * Parses `CAMERAS`, a comma-separated list of `id=Label` pairs, e.g.
 * `pi=Pi cam,webcam=Desk`. The id must match the MediaMTX path name.
 */
export function parseCameras(raw: string | undefined): Camera[] {
  if (raw === undefined || raw.trim() === '') {
    return [];
  }
  const seen = new Set<string>();
  const cameras: Camera[] = [];
  for (const part of raw.split(',')) {
    const entry = part.trim();
    if (entry === '') {
      continue;
    }
    const eq = entry.indexOf('=');
    const id = (eq === -1 ? entry : entry.slice(0, eq)).trim();
    const label = (eq === -1 ? id : entry.slice(eq + 1).trim()) || id;
    if (!CAMERA_ID.test(id)) {
      throw new Error(
        `CAMERAS: invalid camera id "${id}" (use a-z, 0-9, - and _)`,
      );
    }
    if (seen.has(id)) {
      throw new Error(`CAMERAS: duplicate camera id "${id}"`);
    }
    seen.add(id);
    cameras.push({ id, label: label.slice(0, 64) });
  }
  return cameras;
}

/** Only the HLS file name segments MediaMTX produces are forwarded. */
export function isSafeHlsPath(rest: string): boolean {
  if (rest === '') {
    return false;
  }
  return rest
    .split('/')
    .every(
      (segment) =>
        FILE_SEGMENT.test(segment) && segment !== '.' && segment !== '..',
    );
}

type PathItem = {
  name?: unknown;
  online?: unknown;
  ready?: unknown;
  tracks?: unknown;
};

async function readPathStatuses(
  apiUrl: string,
  fetchImpl: typeof fetch,
): Promise<Map<string, PathItem> | null> {
  try {
    const response = await fetchImpl(
      `${apiUrl.replace(/\/$/, '')}/v3/paths/list?itemsPerPage=100`,
      { signal: AbortSignal.timeout(STATUS_TIMEOUT_MS) },
    );
    if (!response.ok) {
      return null;
    }
    const body = (await response.json()) as { items?: unknown };
    const items = Array.isArray(body.items) ? (body.items as PathItem[]) : [];
    const map = new Map<string, PathItem>();
    for (const item of items) {
      if (typeof item.name === 'string') {
        map.set(item.name, item);
      }
    }
    return map;
  } catch {
    return null;
  }
}

function statusOf(item: PathItem | undefined): CameraStatus {
  if (item === undefined) {
    return 'offline';
  }
  const online = item.online ?? item.ready;
  return online === true ? 'live' : 'offline';
}

function tracksOf(item: PathItem | undefined): string[] {
  if (item === undefined || !Array.isArray(item.tracks)) {
    return [];
  }
  return item.tracks.filter((t): t is string => typeof t === 'string');
}

const FORWARDED_RESPONSE_HEADERS = [
  'content-type',
  'content-length',
  'last-modified',
  'etag',
] as const;

export function createCamerasRoutes(config: CamerasConfig | undefined): Hono {
  const routes = new Hono();
  const fetchImpl = config?.fetchImpl ?? globalThis.fetch;
  const byId = new Map((config?.cameras ?? []).map((cam) => [cam.id, cam]));

  routes.get('/', async (c) => {
    if (config === undefined || config.cameras.length === 0) {
      const body: CamerasResponse = { enabled: false, cameras: [] };
      return c.json(body);
    }
    const statuses =
      config.apiUrl === undefined
        ? null
        : await readPathStatuses(config.apiUrl, fetchImpl);
    const body: CamerasResponse = {
      enabled: true,
      cameras: config.cameras.map((cam) => {
        const item = statuses?.get(cam.id);
        return {
          ...cam,
          status: statuses === null ? 'unknown' : statusOf(item),
          tracks: tracksOf(item),
          playlist: `/api/cameras/${cam.id}/hls/index.m3u8`,
        };
      }),
    };
    c.header('Cache-Control', 'no-store');
    return c.json(body);
  });

  routes.get('/:id/hls/*', async (c) => {
    const id = c.req.param('id');
    if (config === undefined || !byId.has(id)) {
      return c.json({ error: 'Not Found' }, 404);
    }

    const url = new URL(c.req.url);
    const prefix = `/api/cameras/${id}/hls/`;
    const rest = url.pathname.startsWith(prefix)
      ? url.pathname.slice(prefix.length)
      : '';
    if (!isSafeHlsPath(rest)) {
      return c.json({ error: 'Not Found' }, 404);
    }

    // Only Low-Latency HLS control params are passed through.
    const upstreamQuery = new URLSearchParams();
    for (const [key, value] of url.searchParams) {
      if (key.startsWith('_HLS_')) {
        upstreamQuery.append(key, value);
      }
    }
    const qs = upstreamQuery.toString();
    const upstream = `${config.hlsUrl.replace(/\/$/, '')}/${id}/${rest}${
      qs === '' ? '' : `?${qs}`
    }`;

    let response: Response;
    try {
      response = await fetchImpl(upstream, {
        signal: AbortSignal.timeout(PROXY_TIMEOUT_MS),
        redirect: 'manual',
      });
    } catch {
      return c.json({ error: 'Camera relay unreachable' }, 502);
    }

    if (response.status === 404) {
      await response.body?.cancel();
      return c.json({ error: 'Stream not available' }, 404);
    }
    if (!response.ok) {
      await response.body?.cancel();
      return c.json({ error: 'Camera relay error' }, 502);
    }

    const headers = new Headers();
    for (const name of FORWARDED_RESPONSE_HEADERS) {
      const value = response.headers.get(name);
      if (value !== null) {
        headers.set(name, value);
      }
    }
    headers.set('Cache-Control', 'private, no-store');
    return new Response(response.body, { status: 200, headers });
  });

  return routes;
}
