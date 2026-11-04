import { describe, expect, it } from 'vitest';
import { loadConfig } from './config.js';
import { sourceConfigs } from './sources.js';

const testDbUrl = 'postgres://postgres:postgres@127.0.0.1:5432/jackson_os_test';

describe('sourceConfigs', () => {
  it('returns demo config and Jim URL with token', () => {
    const config = loadConfig({
      APP_ORIGIN: 'https://app.example.com',
      DATABASE_URL: testDbUrl,
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
    const config = loadConfig({
      APP_ORIGIN: 'https://app.example.com',
      DATABASE_URL: testDbUrl,
    });

    expect(sourceConfigs(config).jim).toEqual({
      baseUrl: 'https://jim-mcp.fly.dev',
      token: '',
    });
  });
});
