import { Writable } from 'node:stream';
import { describe, expect, it } from 'vitest';
import { loadConfig, SECRET_KEYS } from './config.js';
import { createLogger } from './log.js';

const testDbUrl = 'postgres://postgres:postgres@127.0.0.1:5432/jackson_os_test';

describe('createLogger', () => {
  it('redacts secret values one level deep', () => {
    const token = 'c'.repeat(32);
    const config = loadConfig({
      APP_ORIGIN: 'https://app.example.com',
      DATABASE_URL: testDbUrl,
      SETUP_TOKEN: token,
    });

    const chunks: string[] = [];
    const stream = new Writable({
      write(chunk, _encoding, callback) {
        chunks.push(String(chunk));
        callback();
      },
    });

    const logger = createLogger({ secrets: SECRET_KEYS, destination: stream });
    logger.info({ config });

    const output = chunks.join('');
    expect(output).toContain('[redacted]');
    expect(output).not.toContain(token);
  });
});
