import { describe, expect, it } from 'vitest';
import {
  ConfigError,
  loadConfig,
  logDisabledSources,
  resolveFileVars,
  resolveWebDist,
  SECRET_KEYS,
  sourceStatus,
} from './config.js';

describe('SECRET_KEYS', () => {
  it('lists all secret env keys', () => {
    expect(SECRET_KEYS).toEqual([
      'SETUP_TOKEN',
      'JIM_PAT',
      'GITHUB_TOKEN',
      'CLOUDFLARE_API_TOKEN',
      'CLOUDFLARE_ZONE_ID',
    ]);
  });
});

describe('resolveFileVars', () => {
  it('reads secret from file and trims whitespace', () => {
    const token = 'a'.repeat(32);
    const env = resolveFileVars(
      { SETUP_TOKEN_FILE: '/run/secrets/setup' },
      () => `  ${token}\n`,
    );

    expect(env.SETUP_TOKEN).toBe(token);
  });

  it('throws when both direct value and _FILE are set', () => {
    expect(() =>
      resolveFileVars(
        {
          SETUP_TOKEN: 'direct-value',
          SETUP_TOKEN_FILE: '/run/secrets/setup',
        },
        () => 'file-value',
      ),
    ).toThrow(ConfigError);

    try {
      resolveFileVars(
        {
          SETUP_TOKEN: 'direct-value',
          SETUP_TOKEN_FILE: '/run/secrets/setup',
        },
        () => 'file-value',
      );
    } catch (error) {
      expect(error).toBeInstanceOf(ConfigError);
      expect((error as ConfigError).message).toContain('SETUP_TOKEN');
    }
  });

  it('throws naming the key when the file cannot be read', () => {
    expect(() =>
      resolveFileVars({ SETUP_TOKEN_FILE: '/missing/path' }, () => {
        throw new Error('ENOENT');
      }),
    ).toThrow(ConfigError);

    try {
      resolveFileVars({ SETUP_TOKEN_FILE: '/missing/path' }, () => {
        throw new Error('ENOENT');
      });
    } catch (error) {
      expect(error).toBeInstanceOf(ConfigError);
      expect((error as ConfigError).message).toContain('SETUP_TOKEN');
    }
  });
});

describe('loadConfig', () => {
  it('throws ConfigError naming APP_ORIGIN when missing', () => {
    expect(() => loadConfig({})).toThrow(ConfigError);
    try {
      loadConfig({});
    } catch (error) {
      expect(error).toBeInstanceOf(ConfigError);
      expect((error as ConfigError).message).toContain('APP_ORIGIN');
    }
  });

  it('applies defaults when APP_ORIGIN is set', () => {
    const config = loadConfig({ APP_ORIGIN: 'https://app.example.com' });

    expect(config).toEqual({
      NODE_ENV: 'development',
      PORT: 8080,
      APP_ORIGIN: 'https://app.example.com',
      WEB_DIST: resolveWebDist('../web/dist'),
      DATA_DIR: '/data',
      RP_ID: 'os.jacksonyanek.com',
      SETUP_TOKEN: undefined,
      JIM_PAT: undefined,
      GITHUB_TOKEN: undefined,
      CLOUDFLARE_API_TOKEN: undefined,
      CLOUDFLARE_ZONE_ID: undefined,
    });
  });

  it('loads SETUP_TOKEN from SETUP_TOKEN_FILE via injectable readFile', () => {
    const token = 'b'.repeat(32);
    const config = loadConfig(
      {
        APP_ORIGIN: 'https://app.example.com',
        SETUP_TOKEN_FILE: '/secrets/setup',
      },
      () => `${token}\n`,
    );

    expect(config.SETUP_TOKEN).toBe(token);
  });

  it('never includes SETUP_TOKEN value in error text', () => {
    const secret = 'short-secret-value-not-32-chars';
    expect(secret.length).toBeLessThan(32);

    try {
      loadConfig({
        APP_ORIGIN: 'https://app.example.com',
        SETUP_TOKEN: secret,
      });
      expect.fail('expected ConfigError');
    } catch (error) {
      expect(error).toBeInstanceOf(ConfigError);
      const message = (error as ConfigError).message;
      expect(message).toContain('SETUP_TOKEN');
      expect(message).not.toContain(secret);
    }
  });
});

describe('sourceStatus', () => {
  const base = loadConfig({ APP_ORIGIN: 'https://app.example.com' });

  it('marks sources disabled when tokens are missing', () => {
    expect(sourceStatus(base)).toEqual({
      jim: 'disabled',
      github: 'disabled',
      portfolio: 'disabled',
    });
  });

  it('enables portfolio only when both Cloudflare values are set', () => {
    expect(
      sourceStatus({
        ...base,
        CLOUDFLARE_API_TOKEN: 'token',
        CLOUDFLARE_ZONE_ID: undefined,
      }),
    ).toEqual({
      jim: 'disabled',
      github: 'disabled',
      portfolio: 'disabled',
    });

    expect(
      sourceStatus({
        ...base,
        CLOUDFLARE_API_TOKEN: 'token',
        CLOUDFLARE_ZONE_ID: 'zone',
      }),
    ).toEqual({
      jim: 'disabled',
      github: 'disabled',
      portfolio: 'enabled',
    });
  });

  it('enables jim and github when their tokens are present', () => {
    expect(
      sourceStatus({
        ...base,
        JIM_PAT: 'jim-secret',
        GITHUB_TOKEN: 'gh-secret',
      }),
    ).toEqual({
      jim: 'enabled',
      github: 'enabled',
      portfolio: 'disabled',
    });
  });
});

describe('logDisabledSources', () => {
  it('logs each disabled source once', () => {
    const messages: string[] = [];
    const config = loadConfig({ APP_ORIGIN: 'https://app.example.com' });

    logDisabledSources(config, (message) => messages.push(message));

    expect(messages).toEqual([
      'jim source disabled',
      'github source disabled',
      'portfolio source disabled',
    ]);
  });
});
