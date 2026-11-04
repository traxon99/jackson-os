import type { AppConfig } from './config.js';

export function sourceConfigs(config: AppConfig): Record<string, unknown> {
  return {
    demo: {},
    jim: {
      baseUrl: config.JIM_API_URL,
      token: config.JIM_PAT ?? '',
    },
  };
}
