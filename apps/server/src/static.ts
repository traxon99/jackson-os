import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { serveStatic } from '@hono/node-server/serve-static';
import type { Hono } from 'hono';

function pathHasFileExtension(pathname: string): boolean {
  const base = pathname.split('/').pop() ?? '';
  if (base === '') {
    return false;
  }
  const dot = base.lastIndexOf('.');
  return dot > 0 && dot < base.length - 1;
}

export function mountStatic(app: Hono, webDist: string): void {
  const indexHtml = readFileSync(join(webDist, 'index.html'), 'utf8');

  app.use(
    '*',
    serveStatic({
      root: webDist,
      rewriteRequestPath: (path) => path.replace(/^\//, '') || 'index.html',
    }),
  );

  app.get('*', (c, next) => {
    if (c.req.path.startsWith('/api')) {
      return next();
    }
    if (pathHasFileExtension(c.req.path)) {
      return c.notFound();
    }
    return c.html(indexHtml);
  });
}
