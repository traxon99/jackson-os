import { describe, expect, it } from 'vitest';
import { loadConfig } from './config.js';
import { sourceConfigs } from './sources.js';

describe('sourceConfigs', () => {
  it('returns demo config and Jim URL with token', () => {
    const config = loadConfig({
      APP_ORIGIN: 'https://app.example.com',
      JIM_API_URL: 'https://jim.example.com',
      JIM_PAT: 'jim_pat_secret',
    });

    expect(sourceConfigs(config)).toEqual({
      demo: {},
      jim: {
        baseUrl: 'https://jim.example.com',
        token: 'jim_pat_secret',
      },
    });
  });

  it('defaults Jim API URL and empty token when unset', () => {
    const config = loadConfig({ APP_ORIGIN: 'https://app.example.com' });

    expect(sourceConfigs(config).jim).toEqual({
      baseUrl: 'https://jim-mcp.fly.dev',
      token: '',
    });
  });

  it('does not embed secrets in demo entry', () => {
    const config = loadConfig({
      APP_ORIGIN: 'https://app.example.com',
      JIM_PAT: 'secret-token',
    });

    expect(sourceConfigs(config).demo).toEqual({});
    expect(JSON.stringify(sourceConfigs(config))).not.toContain('secret-token');
  });
});
