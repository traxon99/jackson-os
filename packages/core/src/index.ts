export const CORE_VERSION = '0.0.0';

export type {
  ActionDef,
  AdapterContext,
  DatasetDef,
  GridSize,
  HealthResult,
  Logger,
  MetricPoint,
  SourceAdapter,
  SourceId,
  WidgetDef,
  WidgetPayload,
} from './contracts.js';
export {
  type DemoConfig,
  demoAdapter,
  demoWidgets,
  registerDemo,
} from './demo/index.js';
export { formatUpstreamError, UpstreamError } from './errors.js';
export type { JimBody } from './jim/api/body.js';
export type { JimDpr } from './jim/api/dpr.js';
export type { JimLifts } from './jim/api/lifts.js';
export type { JimPlan } from './jim/api/plan.js';
export type { JimPrsList } from './jim/api/prs.js';
export type { JimStatus } from './jim/api/status.js';
export type { JimStreak } from './jim/api/streak.js';
export type { JimWeek } from './jim/api/weeks.js';
export type { JimWorkoutsList } from './jim/api/workouts.js';
export {
  type JimConfig,
  jimAdapter,
  jimWidgets,
  registerJim,
} from './jim/index.js';
export { createRegistry, type Registry } from './registry.js';
export { relativeTime } from './time.js';
