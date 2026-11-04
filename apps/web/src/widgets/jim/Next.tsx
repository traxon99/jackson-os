import type { JimDpr, JimPlan } from '@jos/core';
import { useNow } from '../../dashboard/useNow.js';
import { Meter, Row, Rows } from '../../ui/primitives.js';
import type { WidgetComponent } from '../registry.js';

export type JimNextData = {
  plan: JimPlan;
  dpr: JimDpr;
};

function isSameCalendarDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export const JimNextWidget: WidgetComponent<JimNextData> = {
  View: ({ data }) => {
    const now = useNow();
    const { plan, dpr } = data;

    const scheduledAfterNext = plan.next
      ? plan.scheduled
          .filter((item) => item.date !== plan.next?.date)
          .slice(0, 3)
      : plan.scheduled.slice(0, 3);

    return (
      <>
        <span>
          next{' '}
          {plan.next ? (
            <>
              <a
                href={plan.next.webUrl}
                target="_blank"
                rel="noopener noreferrer"
              >
                {plan.next.routineName}
              </a>{' '}
              <span className="t-mute">
                {plan.next.date &&
                isSameCalendarDay(new Date(`${plan.next.date}T12:00:00`), now)
                  ? 'today'
                  : plan.next.date}
              </span>
            </>
          ) : (
            <span className="t-mute">nothing planned</span>
          )}
        </span>
        {dpr.block ? (
          <>
            <span>
              {dpr.block.name} · week {dpr.block.week}/{dpr.block.weeks}
            </span>
            <Rows columns="1fr auto auto" label="DPR lifts">
              {dpr.block.lifts.map((lift) => (
                <Row key={lift.exerciseId}>
                  <span>{lift.name}</span>
                  <span>
                    {lift.next.weight}×{lift.next.reps}
                  </span>
                  {lift.e1rm !== null && lift.goal !== null ? (
                    <Meter
                      value={lift.e1rm / lift.goal}
                      label={`${lift.name} vs goal`}
                    />
                  ) : (
                    <span />
                  )}
                </Row>
              ))}
            </Rows>
          </>
        ) : null}
        {scheduledAfterNext.map((item) => (
          <span className="t-mute" key={`${item.date}-${item.routineId}`}>
            {item.date} {item.routineName}
          </span>
        ))}
      </>
    );
  },
};
