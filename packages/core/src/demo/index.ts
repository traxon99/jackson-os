import { z } from 'zod';
import type { DatasetDef, SourceAdapter, WidgetDef } from '../contracts.js';

export type DemoConfig = Record<string, never>;

const clockSchema = z.object({ iso: z.string() });
const seriesPointSchema = z.object({ t: z.number(), v: z.number() });
const seriesSchema = z.array(seriesPointSchema).length(20);

type DemoClockData = z.infer<typeof clockSchema>;
type DemoSeriesData = z.infer<typeof seriesSchema>;

function mulberry32(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), state | 1);
    t = (t + Math.imul(t ^ (t >>> 7), t | 61)) | 0;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function seriesForMinute(minute: number): DemoSeriesData {
  const rand = mulberry32(minute);
  const base = minute * 60_000;
  const points: DemoSeriesData = [];
  for (let i = 0; i < 20; i += 1) {
    points.push({ t: base + i * 1000, v: rand() });
  }
  return points;
}

export const clockDataset: DatasetDef<DemoConfig, DemoClockData> = {
  schema: clockSchema,
  refresh: { everyMs: 60_000, staleAfterMs: 120_000 },
  fetch: async (ctx) => {
    if (ctx.signal.aborted) {
      throw new Error('aborted');
    }
    return { iso: ctx.now().toISOString() };
  },
};

export const seriesDataset: DatasetDef<DemoConfig, DemoSeriesData> = {
  schema: seriesSchema,
  refresh: { everyMs: 60_000, staleAfterMs: 120_000 },
  fetch: async (ctx) => {
    if (ctx.signal.aborted) {
      throw new Error('aborted');
    }
    const minute = Math.floor(ctx.now().getTime() / 60_000);
    return seriesForMinute(minute);
  },
  toMetrics: (data) =>
    data.map((point) => ({
      metric: 'demo.value',
      ts: point.t,
      value: point.v,
    })),
};

export const demoAdapter: SourceAdapter<DemoConfig> = {
  id: 'demo',
  displayName: 'Demo',
  configSchema: z.object({}),
  datasets: {
    clock: clockDataset,
    series: seriesDataset,
  },
  actions: {
    noop: {
      input: z.object({ note: z.string().max(100) }),
      run: async () => ({ ok: true as const }),
      invalidates: ['series'],
    },
  },
};

export const demoWidgets: WidgetDef[] = [
  {
    id: 'demo.clock',
    source: 'demo',
    dataset: 'clock',
    title: 'Demo clock',
    sizes: {
      default: { w: 3, h: 2 },
      min: { w: 2, h: 1 },
    },
  },
  {
    id: 'demo.series',
    source: 'demo',
    dataset: 'series',
    title: 'Demo series',
    sizes: {
      default: { w: 6, h: 3 },
      min: { w: 3, h: 2 },
    },
  },
];

export function registerDemo(registry: {
  registerSource: (adapter: SourceAdapter<DemoConfig>) => void;
  registerWidget: (widget: WidgetDef) => void;
}): void {
  registry.registerSource(demoAdapter);
  for (const widget of demoWidgets) {
    registry.registerWidget(widget);
  }
}
