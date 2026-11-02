import { index, integer, primaryKey, real, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const sourceSnapshots = sqliteTable(
  'source_snapshots',
  {
    sourceId: text('source_id').notNull(),
    key: text('key').notNull(),
    payload: text('payload').notNull(),
    fetchedAt: integer('fetched_at').notNull(),
    expiresAt: integer('expires_at'),
    status: text('status').notNull(),
    error: text('error'),
  },
  (table) => [primaryKey({ columns: [table.sourceId, table.key] })],
);

export const metricPoints = sqliteTable(
  'metric_points',
  {
    sourceId: text('source_id').notNull(),
    metric: text('metric').notNull(),
    ts: integer('ts').notNull(),
    value: real('value').notNull(),
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

export const widgetLayout = sqliteTable('widget_layout', {
  id: text('id').primaryKey().notNull().default('default'),
  layout: text('layout').notNull(),
  updatedAt: integer('updated_at').notNull(),
});

export const actionLog = sqliteTable('action_log', {
  id: text('id').primaryKey(),
  widgetId: text('widget_id').notNull(),
  action: text('action').notNull(),
  params: text('params').notNull(),
  result: text('result').notNull(),
  createdAt: integer('created_at').notNull(),
});

export const suggestions = sqliteTable('suggestions', {
  id: text('id').primaryKey(),
  project: text('project').notNull(),
  body: text('body').notNull(),
  inputsHash: text('inputs_hash').notNull(),
  model: text('model').notNull(),
  status: text('status', { enum: ['new', 'done', 'dismissed'] }).notNull(),
  createdAt: integer('created_at').notNull(),
});
