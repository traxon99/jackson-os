import type { JimStatus } from '@jos/core';
import { relativeTime } from '@jos/core';
import { useNow } from '../../dashboard/useNow.js';
import { Tag } from '../../ui/primitives.js';
import type { WidgetComponent } from '../registry.js';

const STALE_MS = 24 * 60 * 60 * 1000;

export const JimStatusWidget: WidgetComponent<JimStatus> = {
  View: ({ data }) => {
    const now = useNow();
    const syncLine = data.lastSyncedAt ? (
      <>
        synced {relativeTime(new Date(data.lastSyncedAt), now)}
        {now.getTime() - new Date(data.lastSyncedAt).getTime() > STALE_MS ? (
          <>
            {' '}
            <Tag tone="warn">stale sync</Tag>
          </>
        ) : null}
      </>
    ) : (
      <>never synced</>
    );

    const workoutLine = data.activeWorkout ? (
      <>
        <Tag tone="accent">training</Tag> {data.activeWorkout.name} ·{' '}
        {relativeTime(new Date(data.activeWorkout.startedAt), now)}
      </>
    ) : (
      <span className="t-mute">no active workout</span>
    );

    return (
      <>
        <span>{syncLine}</span>
        <span>{workoutLine}</span>
        <span className="t-mute">
          {data.user.username} · {data.user.units}
        </span>
      </>
    );
  },
};
