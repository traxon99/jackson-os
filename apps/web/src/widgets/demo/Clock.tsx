import { useState } from 'react';
import { apiPost } from '../../lib/api.js';
import type { WidgetComponent } from '../registry.js';

type ClockData = { iso: string };

export const ClockWidget: WidgetComponent<ClockData> = {
  View: ({ data }) => (
    <time className="demo-clock" dateTime={data.iso}>
      {new Date(data.iso).toLocaleString()}
    </time>
  ),
  actions: ({ invalidate }) => <NoopButton onDone={invalidate} />,
};

function NoopButton({ onDone }: { onDone: () => void }) {
  const [pending, setPending] = useState(false);

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        setPending(true);
        void apiPost('/api/actions/demo/noop', { note: 'clock' })
          .then(onDone)
          .finally(() => setPending(false));
      }}
    >
      Run noop
    </button>
  );
}
