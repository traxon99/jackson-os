import { Sparkline } from '../../ui/primitives.js';
import type { WidgetComponent } from '../registry.js';

type SeriesPoint = { t: number; v: number };

export const SeriesWidget: WidgetComponent<SeriesPoint[]> = {
  View: ({ data }) => {
    if (data.length === 0) {
      return null;
    }
    const values = data.map((point) => point.v);
    const last = values[values.length - 1] ?? 0;

    return (
      <>
        <span>
          <span className="t-label">last</span> {last.toFixed(2)}
          <span className="t-mute"> · {data.length} pts</span>
        </span>
        <Sparkline
          className="demo-series"
          values={values}
          width={280}
          height={80}
          fill
          label="Demo series chart"
        />
      </>
    );
  },
};
