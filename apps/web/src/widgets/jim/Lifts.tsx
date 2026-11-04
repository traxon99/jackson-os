import type { JimLifts } from '@jos/core';
import { Row, Rows, Sparkline } from '../../ui/primitives.js';
import type { WidgetComponent } from '../registry.js';

const selectionFooter: Record<JimLifts['selection'], string> = {
  dpr: 'picked by dpr',
  most_trained: 'most trained',
  explicit: 'your list',
};

export const JimLiftsWidget: WidgetComponent<JimLifts> = {
  View: ({ data }) => (
    <>
      <Rows columns="1fr auto auto auto" label="Lift e1RM trends">
        {data.lifts.map((lift) => (
          <Row key={lift.exerciseId}>
            <span>{lift.name}</span>
            <span>
              {lift.current === null ? '–' : `${lift.current} ${lift.unit}`}
            </span>
            {lift.series.length >= 2 ? (
              <Sparkline
                values={lift.series.map((point) => point.e1rm)}
                width={96}
                height={20}
                label={`${lift.name} e1RM, 90 days`}
              />
            ) : (
              <span>–</span>
            )}
            <span className="t-mute">best {lift.best ?? '–'}</span>
          </Row>
        ))}
      </Rows>
      <span className="t-mute">{selectionFooter[data.selection]}</span>
    </>
  ),
};
