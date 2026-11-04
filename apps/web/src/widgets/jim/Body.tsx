import type { JimBody } from '@jos/core';
import { relativeTime } from '@jos/core';
import { useNow } from '../../dashboard/useNow.js';
import { Sparkline, Stat } from '../../ui/primitives.js';
import type { WidgetComponent } from '../registry.js';

export const JimBodyWidget: WidgetComponent<JimBody> = {
  View: ({ data }) => {
    const now = useNow();
    const bodyweight = data.kinds.find((kind) => kind.kind === 'bodyweight');

    if (!bodyweight?.latest) {
      return <span className="t-mute">no measurements</span>;
    }

    const { latest, change, points } = bodyweight;
    const changeText =
      change === null
        ? null
        : `${change > 0 ? '+' : ''}${change.toFixed(1)} ${latest.unit} / 90d`;

    return (
      <>
        <Stat
          label="bodyweight"
          value={latest.value}
          unit={latest.unit}
          delta={
            <span className="t-mute">
              {relativeTime(new Date(latest.measuredAt), now)}
            </span>
          }
        />
        {changeText ? (
          <span className="tone--neutral">{changeText}</span>
        ) : null}
        <Sparkline
          values={points.map((point) => point.value)}
          width={200}
          height={40}
          fill
          label="Bodyweight, 90 days"
        />
      </>
    );
  },
};
