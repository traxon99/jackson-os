import { type LayoutItem, sortLayoutItems } from './useLayout.js';
import { WidgetHost } from './WidgetHost.js';

type PhoneReorderProps = {
  items: LayoutItem[];
  titles: Record<string, string>;
  onChange: (items: LayoutItem[]) => void;
};

export function PhoneReorder({ items, titles, onChange }: PhoneReorderProps) {
  const ordered = sortLayoutItems(items);

  const move = (index: number, delta: number) => {
    const next = [...ordered];
    const target = index + delta;
    if (target < 0 || target >= next.length) {
      return;
    }
    const current = next[index];
    const swapWith = next[target];
    if (current === undefined || swapWith === undefined) {
      return;
    }
    next[index] = swapWith;
    next[target] = current;
    onChange(
      next.map((item, y) => ({
        ...item,
        y,
      })),
    );
  };

  return (
    <div className="phone-layout">
      {ordered.map((item, index) => (
        <div key={item.i} className="phone-layout__row">
          <WidgetHost id={item.i} title={titles[item.i] ?? item.i} />
          <div className="phone-layout__controls">
            <button
              type="button"
              aria-label={`Move ${titles[item.i] ?? item.i} up`}
              disabled={index === 0}
              onClick={() => move(index, -1)}
            >
              ↑
            </button>
            <button
              type="button"
              aria-label={`Move ${titles[item.i] ?? item.i} down`}
              disabled={index === ordered.length - 1}
              onClick={() => move(index, 1)}
            >
              ↓
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}

export function PhoneLayout({
  items,
  titles,
}: {
  items: LayoutItem[];
  titles: Record<string, string>;
}) {
  return (
    <div className="phone-layout">
      {sortLayoutItems(items).map((item) => (
        <div key={item.i} className="phone-layout__row">
          <WidgetHost id={item.i} title={titles[item.i] ?? item.i} />
        </div>
      ))}
    </div>
  );
}
