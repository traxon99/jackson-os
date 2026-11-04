import type { JimBackend, JimBackendService } from '@jos/core';
import { relativeTime } from '@jos/core';
import { useNow } from '../../dashboard/useNow.js';
import { Row, Rows, type Status, StatusDot } from '../../ui/primitives.js';
import type { WidgetComponent } from '../registry.js';

function serviceUiStatus(status: JimBackendService['status']): {
  dot: Status;
  word: string;
} {
  switch (status) {
    case 'operational':
      return { dot: 'ok', word: 'OK' };
    case 'degraded':
      return { dot: 'warn', word: 'WARN' };
    case 'down':
      return { dot: 'error', word: 'ERR' };
    default:
      return { dot: 'warn', word: 'UNK' };
  }
}

function shortSha(sha: string): string {
  return sha.length > 7 ? sha.slice(0, 7) : sha;
}

function formatCount(value: number): string {
  if (value >= 1_000_000) {
    return `${(value / 1_000_000).toFixed(1)}M`;
  }
  if (value >= 1000) {
    return `${(value / 1000).toFixed(1)}k`;
  }
  return String(value);
}

function formatBytes(bytes: number): string {
  if (bytes >= 1_073_741_824) {
    return `${(bytes / 1_073_741_824).toFixed(1)} GiB`;
  }
  if (bytes >= 1_048_576) {
    return `${(bytes / 1_048_576).toFixed(0)} MiB`;
  }
  return `${formatCount(bytes)} B`;
}

function serviceSummary(service: JimBackendService): string {
  switch (service.id) {
    case 'vercel': {
      const cron =
        service.cron?.enabled === true
          ? `${service.cron.jobs.length} cron`
          : 'no cron';
      return `${service.deployment.environment} ${service.deployment.state} · ${shortSha(service.deployment.commitSha)} · ${cron}`;
    }
    case 'supabase': {
      const extras = [
        service.auth?.enabled ? 'auth' : null,
        service.storage?.enabled ? 'storage' : null,
        service.realtime?.enabled ? 'realtime' : null,
      ].filter(Boolean);
      const features = extras.length > 0 ? extras.join('+') : 'core';
      return `${service.project.status} · ${service.project.region} · ${service.database.pooler} · ${features}`;
    }
    case 'cloudflare': {
      const traffic = service.analytics
        ? `${formatCount(service.analytics.requests24h)} req · ${formatCount(service.analytics.uniqueVisitors24h)} uv · ${formatBytes(service.analytics.bytes24h)}`
        : 'no analytics';
      const waf =
        service.waf?.enabled === true
          ? `waf ${service.waf.challenged24h} ch`
          : 'waf off';
      return `${service.zone.name} · ${service.zone.ssl} · ${traffic} · ${waf}`;
    }
    case 'fly': {
      const health = service.healthCheck.passing ? 'hc ok' : 'hc fail';
      const image = service.image ? `${service.image.sizeMb} MiB` : 'image n/a';
      return `${service.app} ${service.region} · ${service.machines.started}/${service.machines.total} · ${health} · ${image}`;
    }
  }
  return '';
}

function serviceUrl(service: JimBackendService): string | undefined {
  if (service.id === 'vercel') {
    return service.deployment.url;
  }
  return undefined;
}

export const JimBackendWidget: WidgetComponent<JimBackend> = {
  View: ({ data }) => {
    const now = useNow();
    return (
      <>
        <span className="t-mute">
          checked {relativeTime(new Date(data.checkedAt), now)}
        </span>
        <Rows columns="auto auto 1fr" label="Jim infrastructure">
          {data.services.map((service) => {
            const ui = serviceUiStatus(service.status);
            const href = serviceUrl(service);
            const label = service.label.toLowerCase();
            return (
              <Row href={href} key={service.id}>
                <span>
                  <StatusDot status={ui.dot} /> {ui.word}
                </span>
                <span className="t-label">{label}</span>
                <span>{serviceSummary(service)}</span>
              </Row>
            );
          })}
        </Rows>
      </>
    );
  },
};
