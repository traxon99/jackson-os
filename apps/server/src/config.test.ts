import { describe, expect, it } from 'vitest';
import { ConfigError, loadConfig } from './config.js';

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
      DATA_DIR: '/data',
      RP_ID: 'os.jacksonyanek.com',
      SETUP_TOKEN: undefined,
    });
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
