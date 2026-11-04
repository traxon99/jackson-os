import type { JimWorkoutsList } from '@jos/core';
import { Row, Rows, Tag } from '../../ui/primitives.js';
import type { WidgetComponent } from '../registry.js';

const dateFmt = new Intl.DateTimeFormat(undefined, {
  weekday: 'short',
  day: 'numeric',
});

export const JimRecentWidget: WidgetComponent<JimWorkoutsList> = {
  View: ({ data }) => {
    if (data.workouts.length === 0) {
      return <span className="t-mute">no workouts yet</span>;
    }

    return (
      <Rows columns="auto 1fr auto auto auto" label="Recent workouts">
        {data.workouts.map((workout) => (
          <Row href={workout.webUrl} linkCell={1} key={workout.id}>
            <span>{dateFmt.format(new Date(workout.startedAt))}</span>
            <span>{workout.name}</span>
            <span>{workout.durationMinutes}m</span>
            <span>{workout.workingSets} sets</span>
            {workout.prCount > 0 ? (
              <Tag tone="accent">{workout.prCount} pr</Tag>
            ) : (
              <span />
            )}
          </Row>
        ))}
      </Rows>
    );
  },
};
