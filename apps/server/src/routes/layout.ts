import type { Registry } from '@jos/core';
import { widgetLayout } from '@jos/db';
import { eq } from 'drizzle-orm';
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3';
import { Hono } from 'hono';
import { z } from 'zod';

export type LayoutItem = {
  i: string;
  x: number;
  y: number;
  w: number;
  h: number;
};

export type LayoutResponse = {
  id: string;
  items: LayoutItem[];
};

const layoutItemSchema = z.object({
  i: z.string(),
  x: z.number().int().nonnegative(),
  y: z.number().int().nonnegative(),
  w: z.number().int().positive(),
  h: z.number().int().positive(),
});

const putBodySchema = z.object({
  items: z.array(layoutItemSchema),
});

export type LayoutRoutesDeps = {
  registry: Registry;
  db: BetterSQLite3Database;
  now: () => number;
};

export function buildDefaultLayout(registry: Registry): LayoutItem[] {
  const items: LayoutItem[] = [];
  let x = 0;
  let y = 0;
  let rowHeight = 0;

  for (const widget of registry.listWidgets()) {
    const { w, h } = widget.sizes.default;
    if (x + w > 12) {
      x = 0;
      y += rowHeight;
      rowHeight = 0;
    }
    items.push({ i: widget.id, x, y, w, h });
    x += w;
    rowHeight = Math.max(rowHeight, h);
  }

  return items;
}

function validateLayoutItems(
  registry: Registry,
  items: LayoutItem[],
): string | null {
  for (const item of items) {
    const widget = registry.getWidget(item.i);
    if (widget === undefined) {
      return `unknown widget: ${item.i}`;
    }
    const { min, max } = widget.sizes;
    if (item.w < min.w || item.h < min.h) {
      return `size below min for ${item.i}`;
    }
    if (max !== undefined) {
      if (item.w > max.w || item.h > max.h) {
        return `size above max for ${item.i}`;
      }
    }
  }
  return null;
}

export function createLayoutRoutes(deps: LayoutRoutesDeps): Hono {
  const routes = new Hono();

  routes.get('/', (c) => {
    const rows = deps.db
      .select()
      .from(widgetLayout)
      .where(eq(widgetLayout.id, 'default'))
      .all();
    const row = rows[0];

    if (row === undefined) {
      return c.json({
        id: 'default',
        items: buildDefaultLayout(deps.registry),
      } satisfies LayoutResponse);
    }

    const items = JSON.parse(row.layout) as LayoutItem[];
    return c.json({ id: row.id, items } satisfies LayoutResponse);
  });

  routes.put('/', async (c) => {
    let body: unknown;
    try {
      body = await c.req.json();
    } catch {
      return c.json({ error: 'Bad Request' }, 400);
    }

    const parsed = putBodySchema.safeParse(body);
    if (!parsed.success) {
      return c.json({ error: 'Bad Request', issues: parsed.error.issues }, 400);
    }

    const validationError = validateLayoutItems(
      deps.registry,
      parsed.data.items,
    );
    if (validationError !== null) {
      return c.json({ error: validationError }, 400);
    }

    const layoutJson = JSON.stringify(parsed.data.items);
    const updatedAt = deps.now();
    deps.db
      .insert(widgetLayout)
      .values({ id: 'default', layout: layoutJson, updatedAt })
      .onConflictDoUpdate({
        target: widgetLayout.id,
        set: { layout: layoutJson, updatedAt },
      })
      .run();

    return c.json({ id: 'default', items: parsed.data.items });
  });

  return routes;
}
