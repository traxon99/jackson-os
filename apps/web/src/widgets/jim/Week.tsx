import type { JimStreak, JimWeek } from '@jos/core';
import { Delta, Row, Rows, Stat, Tag } from '../../ui/primitives.js';
import type { WidgetComponent } from '../registry.js';

export type JimTrainingData = {
  weeks: JimWeek[];
  streak: JimStreak;
};

const muscleOrder = { under: 0, within: 1, over: 2 } as const;

function isRestWeek(week: JimWeek): boolean {
  return (
    week.workouts === 0 &&
    week.workingSets === 0 &&
    week.volume === 0 &&
    week.muscles.length === 0
  );
}

export const JimWeekWidget: WidgetComponent<JimTrainingData> = {
  View: ({ data }) => {
    const thisWeek = data.weeks[0];
    const lastWeek = data.weeks[1] ?? null;

    if (!thisWeek) {
      return <span className="t-mute">no week data</span>;
    }

    const muscles = [...thisWeek.muscles]
      .sort((a, b) => muscleOrder[a.status] - muscleOrder[b.status])
      .slice(0, 6);

    const onTrack = data.streak.thisWeek.done >= data.streak.thisWeek.target;

    return (
      <>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
            gap: 'var(--gap)',
          }}
        >
          <Stat
            label="workouts"
            value={thisWeek.workouts}
            delta={
              <Delta
                current={thisWeek.workouts}
                previous={lastWeek?.workouts}
                goodWhen="up"
              />
            }
          />
          <Stat
            label="sets"
            value={thisWeek.workingSets}
            delta={
              <Delta
                current={thisWeek.workingSets}
                previous={lastWeek?.workingSets}
                goodWhen="up"
              />
            }
          />
          <Stat
            label="volume"
            value={thisWeek.volume.toLocaleString()}
            delta={
              <Delta
                current={thisWeek.volume}
                previous={lastWeek?.volume}
                goodWhen="up"
              />
            }
          />
        </div>
        <span>
          streak {data.streak.weeks}w · {data.streak.thisWeek.done}/
          {data.streak.thisWeek.target} this week · best {data.streak.longest}w
          {onTrack ? (
            <>
              {' '}
              <Tag tone="ok">on track</Tag>
            </>
          ) : null}
        </span>
        {isRestWeek(thisWeek) ? (
          <span className="t-mute">rest week</span>
        ) : (
          <Rows columns="1fr auto auto auto" label="Muscles this week">
            {muscles.map((muscle) => (
              <Row key={muscle.muscle}>
                <span>{muscle.muscle}</span>
                <span>{muscle.sets}</span>
                <span>
                  {muscle.target.low}–{muscle.target.high}
                </span>
                <Tag
                  tone={
                    muscle.status === 'under'
                      ? 'warn'
                      : muscle.status === 'within'
                        ? 'ok'
                        : 'neutral'
                  }
                >
                  {muscle.status}
                </Tag>
              </Row>
            ))}
          </Rows>
        )}
      </>
    );
  },
};
