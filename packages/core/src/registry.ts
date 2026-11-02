import type { SourceAdapter, SourceId, WidgetDef } from './contracts.js';

export type Registry = ReturnType<typeof createRegistry>;

export function createRegistry() {
  const sources = new Map<SourceId, SourceAdapter>();
  const widgets = new Map<string, WidgetDef>();

  function registerSource(adapter: SourceAdapter): void {
    if (sources.has(adapter.id)) {
      throw new Error(`source already registered: ${adapter.id}`);
    }
    sources.set(adapter.id, adapter);
  }

  function registerWidget(widget: WidgetDef): void {
    if (widgets.has(widget.id)) {
      throw new Error(`widget already registered: ${widget.id}`);
    }
    const source = sources.get(widget.source);
    if (source === undefined) {
      throw new Error(`unknown source for widget: ${widget.source}`);
    }
    if (!(widget.dataset in source.datasets)) {
      throw new Error(`unknown dataset for widget: ${widget.dataset}`);
    }
    widgets.set(widget.id, widget);
  }

  return {
    registerSource,
    registerWidget,
    getSource: (id: SourceId) => sources.get(id),
    getWidget: (id: string) => widgets.get(id),
    listSources: () => [...sources.values()],
    listWidgets: () => [...widgets.values()],
  };
}
