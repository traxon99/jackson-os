import type { JimPrsList } from '@jos/core';
import { relativeTime } from '@jos/core';
import { useNow } from '../../dashboard/useNow.js';
import { Delta, Row, Rows, Tag } from '../../ui/primitives.js';
import type { WidgetComponent } from '../registry.js';

export const JimPrsWidget: WidgetComponent<JimPrsList> = {
  View: ({ data }) => {
    const now = useNow();

    if (data.prs.length === 0) {
      return <span className="t-mute">no prs in 30 days</span>;
    }

    return (
      <Rows columns="1fr auto auto auto" label="Recent PRs">
        {data.prs.map((pr) => (
          <Row key={`${pr.exerciseId}-${pr.achievedAt}`}>
            <span>
              {pr.exerciseName}
              {pr.tier ? (
                <>
                  {' '}
                  <Tag tone="accent">{pr.tier}</Tag>
                </>
              ) : null}
            </span>
            <span>
              {pr.value} {pr.unit}
            </span>
            <Delta current={pr.value} previous={pr.previousValue} />
            <span>{relativeTime(new Date(pr.achievedAt), now)}</span>
          </Row>
        ))}
      </Rows>
    );
  },
};
