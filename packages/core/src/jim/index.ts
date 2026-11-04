import { z } from 'zod';
import type { DatasetDef, SourceAdapter, WidgetDef } from '../contracts.js';
import { getBackend, jimBackendSchema } from './api/backend.js';
import { getBodyMeasurements, jimBodySchema } from './api/body.js';
import { getDpr, jimDprSchema } from './api/dpr.js';
import { getLifts, jimLiftsSchema } from './api/lifts.js';
import { getPlan, jimPlanSchema } from './api/plan.js';
import { jimPrsListSchema, listPrs } from './api/prs.js';
import { getStatus, jimStatusSchema } from './api/status.js';
import { getStreak, jimStreakSchema } from './api/streak.js';
import { getWeeks, jimWeekSchema } from './api/weeks.js';
import { jimWorkoutsListSchema, listWorkouts } from './api/workouts.js';
import { type JimConfig, jimConfigSchema } from './config.js';

export type { JimConfig } from './config.js';

function isoDateDaysBefore(now: Date, days: number): string {
  const date = new Date(now.getTime());
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}

const trainingSchema = z.object({
  weeks: z.array(jimWeekSchema),
  streak: jimStreakSchema,
});

const nextSchema = z.object({
  plan: jimPlanSchema,
  dpr: jimDprSchema,
});

type JimStatusData = z.infer<typeof jimStatusSchema>;
type JimTrainingData = z.infer<typeof trainingSchema>;
type JimWorkoutsData = z.infer<typeof jimWorkoutsListSchema>;
type JimPrsData = z.infer<typeof jimPrsListSchema>;
type JimLiftsData = z.infer<typeof jimLiftsSchema>;
type JimBodyData = z.infer<typeof jimBodySchema>;
type JimNextData = z.infer<typeof nextSchema>;
type JimBackendData = z.infer<typeof jimBackendSchema>;

const statusDataset: DatasetDef<JimConfig, JimStatusData> = {
  schema: jimStatusSchema,
  refresh: {
    everyMs: 5 * 60_000,
    staleAfterMs: 15 * 60_000,
    maxBackoffMs: 60 * 60_000,
  },
  fetch: async (ctx) => {
    if (ctx.signal.aborted) {
      throw new Error('aborted');
    }
    return getStatus(ctx);
  },
};

const trainingDataset: DatasetDef<JimConfig, JimTrainingData> = {
  schema: trainingSchema,
  refresh: {
    everyMs: 15 * 60_000,
    staleAfterMs: 60 * 60_000,
    maxBackoffMs: 60 * 60_000,
  },
  fetch: async (ctx) => {
    if (ctx.signal.aborted) {
      throw new Error('aborted');
    }
    const [weeksResult, streak] = await Promise.all([
      getWeeks(ctx, { weeks: 2 }),
      getStreak(ctx),
    ]);
    return { weeks: weeksResult.weeks, streak };
  },
  toMetrics: (data) => {
    const points = [];
    for (const week of data.weeks) {
      const ts = Date.parse(week.weekStart);
      points.push({
        metric: 'jim.workouts',
        ts,
        value: week.workouts,
      });
      points.push({
        metric: 'jim.working_sets',
        ts,
        value: week.workingSets,
      });
      points.push({
        metric: 'jim.volume',
        ts,
        value: week.volume,
      });
    }
    return points;
  },
};

const workoutsDataset: DatasetDef<JimConfig, JimWorkoutsData> = {
  schema: jimWorkoutsListSchema,
  refresh: { everyMs: 15 * 60_000, staleAfterMs: 60 * 60_000 },
  fetch: async (ctx) => {
    if (ctx.signal.aborted) {
      throw new Error('aborted');
    }
    return listWorkouts(ctx, { limit: 8 });
  },
};

const prsDataset: DatasetDef<JimConfig, JimPrsData> = {
  schema: jimPrsListSchema,
  refresh: { everyMs: 60 * 60_000, staleAfterMs: 6 * 60 * 60_000 },
  fetch: async (ctx) => {
    if (ctx.signal.aborted) {
      throw new Error('aborted');
    }
    const since = isoDateDaysBefore(ctx.now(), 30);
    return listPrs(ctx, { since, limit: 10 });
  },
};

const liftsDataset: DatasetDef<JimConfig, JimLiftsData> = {
  schema: jimLiftsSchema,
  refresh: { everyMs: 6 * 60 * 60_000, staleAfterMs: 24 * 60 * 60_000 },
  fetch: async (ctx) => {
    if (ctx.signal.aborted) {
      throw new Error('aborted');
    }
    const from = isoDateDaysBefore(ctx.now(), 90);
    return getLifts(ctx, { from });
  },
  toMetrics: (data) =>
    data.lifts.flatMap((lift) => {
      const latest = lift.series.at(-1);
      if (latest === undefined) {
        return [];
      }
      return [
        {
          metric: 'jim.e1rm',
          ts: Date.parse(latest.date),
          value: latest.e1rm,
          dims: { exercise: lift.exerciseId },
        },
      ];
    }),
};

const bodyDataset: DatasetDef<JimConfig, JimBodyData> = {
  schema: jimBodySchema,
  refresh: { everyMs: 6 * 60 * 60_000, staleAfterMs: 24 * 60 * 60_000 },
  fetch: async (ctx) => {
    if (ctx.signal.aborted) {
      throw new Error('aborted');
    }
    const from = isoDateDaysBefore(ctx.now(), 90);
    return getBodyMeasurements(ctx, { kinds: ['bodyweight'], from });
  },
  toMetrics: (data) => {
    const bodyweight = data.kinds.find((kind) => kind.kind === 'bodyweight');
    if (bodyweight?.latest === null || bodyweight?.latest === undefined) {
      return [];
    }
    return [
      {
        metric: 'jim.bodyweight',
        ts: Date.parse(bodyweight.latest.measuredAt),
        value: bodyweight.latest.value,
      },
    ];
  },
};

// Read-only: Jackson OS never starts or changes a workout (traxon99/jim#735, ADR-022).
const backendDataset: DatasetDef<JimConfig, JimBackendData> = {
  schema: jimBackendSchema,
  refresh: {
    everyMs: 5 * 60_000,
    staleAfterMs: 15 * 60_000,
    maxBackoffMs: 60 * 60_000,
  },
  fetch: async (ctx) => {
    if (ctx.signal.aborted) {
      throw new Error('aborted');
    }
    return getBackend(ctx);
  },
};

const nextDataset: DatasetDef<JimConfig, JimNextData> = {
  schema: nextSchema,
  refresh: { everyMs: 30 * 60_000, staleAfterMs: 2 * 60 * 60_000 },
  fetch: async (ctx) => {
    if (ctx.signal.aborted) {
      throw new Error('aborted');
    }
    const [plan, dpr] = await Promise.all([
      getPlan(ctx, { days: 7 }),
      getDpr(ctx),
    ]);
    return { plan, dpr };
  },
};

export const jimAdapter: SourceAdapter<JimConfig> = {
  id: 'jim',
  displayName: 'Jim',
  configSchema: jimConfigSchema,
  datasets: {
    status: statusDataset,
    training: trainingDataset,
    workouts: workoutsDataset,
    prs: prsDataset,
    lifts: liftsDataset,
    body: bodyDataset,
    next: nextDataset,
    backend: backendDataset,
  },
  healthCheck: async (ctx) => {
    try {
      await getStatus(ctx);
      return { ok: true };
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      return { ok: false, detail };
    }
  },
};

export const jimWidgets: WidgetDef[] = [
  {
    id: 'jim.status',
    source: 'jim',
    dataset: 'status',
    title: 'jim',
    sizes: {
      default: { w: 3, h: 2 },
      min: { w: 2, h: 2 },
    },
  },
  {
    id: 'jim.week',
    source: 'jim',
    dataset: 'training',
    title: 'training',
    sizes: {
      default: { w: 6, h: 3 },
      min: { w: 3, h: 3 },
    },
  },
  {
    id: 'jim.recent',
    source: 'jim',
    dataset: 'workouts',
    title: 'workouts',
    sizes: {
      default: { w: 6, h: 3 },
      min: { w: 3, h: 3 },
    },
  },
  {
    id: 'jim.prs',
    source: 'jim',
    dataset: 'prs',
    title: 'prs',
    sizes: {
      default: { w: 4, h: 3 },
      min: { w: 3, h: 2 },
    },
  },
  {
    id: 'jim.lifts',
    source: 'jim',
    dataset: 'lifts',
    title: 'lifts',
    sizes: {
      default: { w: 6, h: 3 },
      min: { w: 4, h: 3 },
    },
  },
  {
    id: 'jim.body',
    source: 'jim',
    dataset: 'body',
    title: 'body',
    sizes: {
      default: { w: 3, h: 3 },
      min: { w: 3, h: 2 },
    },
  },
  {
    id: 'jim.next',
    source: 'jim',
    dataset: 'next',
    title: 'next',
    sizes: {
      default: { w: 4, h: 3 },
      min: { w: 3, h: 2 },
    },
  },
  {
    id: 'jim.backend',
    source: 'jim',
    dataset: 'backend',
    title: 'backend',
    sizes: {
      default: { w: 6, h: 4 },
      min: { w: 4, h: 3 },
    },
  },
];

export function registerJim(registry: {
  registerSource: (adapter: SourceAdapter<JimConfig>) => void;
  registerWidget: (widget: WidgetDef) => void;
}): void {
  registry.registerSource(jimAdapter);
  for (const widget of jimWidgets) {
    registry.registerWidget(widget);
  }
}
