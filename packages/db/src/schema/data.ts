import {
  bigint,
  doublePrecision,
  index,
  pgTable,
  primaryKey,
  text,
} from 'drizzle-orm/pg-core';

export const sourceSnapshots = pgTable(
  'source_snapshots',
  {
    sourceId: text('source_id').notNull(),
    key: text('key').notNull(),
    payload: text('payload').notNull(),
    fetchedAt: bigint('fetched_at', { mode: 'number' }).notNull(),
    expiresAt: bigint('expires_at', { mode: 'number' }),
    status: text('status').notNull(),
    error: text('error'),
  },
  (table) => [primaryKey({ columns: [table.sourceId, table.key] })],
);

export const metricPoints = pgTable(
  'metric_points',
  {
    sourceId: text('source_id').notNull(),
    metric: text('metric').notNull(),
    ts: bigint('ts', { mode: 'number' }).notNull(),
    value: doublePrecision('value').notNull(),
    dims: text('dims'),
  },
  (table) => [
    index('metric_points_source_metric_ts_idx').on(
      table.sourceId,
      table.metric,
      table.ts,
    ),
  ],
);

export const widgetLayout = pgTable('widget_layout', {
  id: text('id').primaryKey().notNull().default('default'),
  layout: text('layout').notNull(),
  updatedAt: bigint('updated_at', { mode: 'number' }).notNull(),
});

export const actionLog = pgTable('action_log', {
  id: text('id').primaryKey(),
  widgetId: text('widget_id').notNull(),
  action: text('action').notNull(),
  params: text('params').notNull(),
  result: text('result').notNull(),
  createdAt: bigint('created_at', { mode: 'number' }).notNull(),
});

export const suggestions = pgTable('suggestions', {
  id: text('id').primaryKey(),
  project: text('project').notNull(),
  body: text('body').notNull(),
  inputsHash: text('inputs_hash').notNull(),
  model: text('model').notNull(),
  status: text('status', { enum: ['new', 'done', 'dismissed'] }).notNull(),
  createdAt: bigint('created_at', { mode: 'number' }).notNull(),
});
