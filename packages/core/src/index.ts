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
export { createRegistry, type Registry } from './registry.js';
