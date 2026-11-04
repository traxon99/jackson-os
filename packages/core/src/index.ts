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
export { createRegistry, type Registry } from './registry.js';
export { relativeTime } from './time.js';
