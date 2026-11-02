import { demoWidgets } from '@jos/core';
import { useEffect, useMemo, useState } from 'react';
import { type Layout, Responsive, WidthProvider } from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';
import { PhoneLayout, PhoneReorder } from './PhoneReorder.js';
import { type LayoutItem, sortLayoutItems, useLayout } from './useLayout.js';
import { WidgetHost } from './WidgetHost.js';

const ResponsiveGridLayout = WidthProvider(Responsive);

const breakpoints = { lg: 1024, md: 768, sm: 0 };
const cols = { lg: 12, md: 12, sm: 1 };

function layoutToItems(layout: Layout[]): LayoutItem[] {
  return layout.map(({ i, x, y, w, h }) => ({ i, x, y, w, h }));
}

export function Dashboard() {
  const { layoutQuery, saveLayout, isSaving } = useLayout();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<LayoutItem[] | null>(null);
  const [isPhone, setIsPhone] = useState(
    () => window.matchMedia('(max-width: 767px)').matches,
  );

  useEffect(() => {
    const media = window.matchMedia('(max-width: 767px)');
    const onChange = () => setIsPhone(media.matches);
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);

  const titles = useMemo(
    () =>
      Object.fromEntries(
        demoWidgets.map((widget) => [widget.id, widget.title]),
      ),
    [],
  );

  const items = draft ?? layoutQuery.data?.items ?? [];

  const startEditing = () => {
    setDraft(layoutQuery.data?.items ?? []);
    setEditing(true);
  };

  const finishEditing = async () => {
    await saveLayout(items);
    setDraft(null);
    setEditing(false);
  };

  if (layoutQuery.isLoading) {
    return <p>Loading layout…</p>;
  }

  if (isPhone) {
    return (
      <div className="dashboard">
        <header className="dashboard__toolbar">
          <h1>Dashboard</h1>
          {editing ? (
            <button
              type="button"
              disabled={isSaving}
              onClick={() => void finishEditing()}
            >
              Done
            </button>
          ) : (
            <button type="button" onClick={startEditing}>
              Edit
            </button>
          )}
        </header>
        {editing ? (
          <PhoneReorder items={items} titles={titles} onChange={setDraft} />
        ) : (
          <PhoneLayout items={items} titles={titles} />
        )}
      </div>
    );
  }

  return (
    <div className="dashboard">
      <header className="dashboard__toolbar">
        <h1>Dashboard</h1>
        {editing ? (
          <button
            type="button"
            disabled={isSaving}
            onClick={() => void finishEditing()}
          >
            Done
          </button>
        ) : (
          <button type="button" onClick={startEditing}>
            Edit
          </button>
        )}
      </header>

      <ResponsiveGridLayout
        className="dashboard-grid"
        breakpoints={breakpoints}
        cols={cols}
        rowHeight={48}
        isDraggable={editing}
        isResizable={editing}
        compactType={null}
        layouts={{
          lg: items,
          md: items,
          sm: items,
        }}
        onLayoutChange={(_current, allLayouts) => {
          if (!editing) {
            return;
          }
          const next = allLayouts.lg ?? _current;
          setDraft(layoutToItems(next));
        }}
      >
        {sortLayoutItems(items).map((item) => (
          <div
            key={item.i}
            data-grid={{
              i: item.i,
              x: item.x,
              y: item.y,
              w: item.w,
              h: item.h,
              static: !editing,
            }}
          >
            <WidgetHost id={item.i} title={titles[item.i] ?? item.i} />
          </div>
        ))}
      </ResponsiveGridLayout>
    </div>
  );
}
