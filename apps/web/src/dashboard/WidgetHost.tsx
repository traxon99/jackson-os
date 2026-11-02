import type { WidgetPayload } from '@jos/core';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiGet } from '../lib/api.js';
import { getWidgetComponent } from '../widgets/registry.js';
import { WidgetFrame } from './WidgetFrame.js';

type WidgetHostProps = {
  id: string;
  title: string;
};

export function WidgetHost({ id, title }: WidgetHostProps) {
  const queryClient = useQueryClient();
  const widgetQuery = useQuery({
    queryKey: ['widget', id],
    queryFn: () => apiGet<WidgetPayload<unknown>>(`/api/widgets/${id}`),
  });

  const component = getWidgetComponent(id);
  if (component === undefined) {
    return null;
  }

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['widget', id] });
  };

  return (
    <WidgetFrame
      title={title}
      payload={widgetQuery.data}
      isLoading={widgetQuery.isLoading}
      onRetry={() => void widgetQuery.refetch()}
      actions={component.actions?.({ id, invalidate })}
    >
      {(data) => component.View({ data })}
    </WidgetFrame>
  );
}
