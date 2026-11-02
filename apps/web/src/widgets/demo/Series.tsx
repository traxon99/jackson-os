import type { WidgetComponent } from '../registry.js';

type SeriesPoint = { t: number; v: number };

export const SeriesWidget: WidgetComponent<SeriesPoint[]> = {
  View: ({ data }) => {
    if (data.length === 0) {
      return null;
    }

    const width = 280;
    const height = 80;
    const minV = Math.min(...data.map((p) => p.v));
    const maxV = Math.max(...data.map((p) => p.v));
    const spanV = maxV - minV || 1;

    const points = data
      .map((point, index) => {
        const x = (index / Math.max(data.length - 1, 1)) * width;
        const y = height - ((point.v - minV) / spanV) * height;
        return `${x},${y}`;
      })
      .join(' ');

    return (
      <svg
        className="demo-series"
        viewBox={`0 0 ${width} ${height}`}
        width="100%"
        height={height}
        role="img"
        aria-label="Demo series chart"
      >
        <polyline
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          points={points}
        />
      </svg>
    );
  },
};
