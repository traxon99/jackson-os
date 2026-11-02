import { getConnInfo } from '@hono/node-server/conninfo';
import type { Context } from 'hono';

export function clientIp(c: Context, trustCloudflare: boolean): string {
  if (trustCloudflare) {
    const cfIp = c.req.header('CF-Connecting-IP');
    if (cfIp !== undefined && cfIp !== '') {
      return cfIp;
    }
  }

  try {
    const info = getConnInfo(c);
    if (info.remote.address !== undefined && info.remote.address !== '') {
      return info.remote.address;
    }
  } catch {
    // app.request() in tests has no Node server bindings
  }

  return '127.0.0.1';
}
