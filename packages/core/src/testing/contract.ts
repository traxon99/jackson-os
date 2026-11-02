import { describe, expect, it } from 'vitest';
import type { AdapterContext, Logger, SourceAdapter } from '../contracts.js';

export type RunAdapterContractOptions<TConfig> = {
  config: TConfig;
  secrets: readonly string[];
};

function createTestContext<TConfig>(
  options: RunAdapterContractOptions<TConfig>,
  signal: AbortSignal,
): AdapterContext<TConfig> {
  const log: Logger = {
    info: () => {},
    warn: () => {},
    error: () => {},
  };
  return {
    config: options.config,
    fetch: globalThis.fetch,
    log,
    now: () => new Date('2026-01-01T12:00:00.000Z'),
    signal,
  };
}

function jsonContainsSecret(
  value: unknown,
  secrets: readonly string[],
): boolean {
  const text = JSON.stringify(value);
  return secrets.some((secret) => secret.length > 0 && text.includes(secret));
}

export function runAdapterContract<TConfig>(
  adapter: SourceAdapter<TConfig>,
  options: RunAdapterContractOptions<TConfig>,
): void {
  describe(`${adapter.id} adapter contract`, () => {
    for (const [datasetId, dataset] of Object.entries(adapter.datasets)) {
      it(`${datasetId} fetch output passes schema`, async () => {
        const ctx = createTestContext(options, new AbortController().signal);
        const data = await dataset.fetch(ctx);
        expect(() => dataset.schema.parse(data)).not.toThrow();
        expect(jsonContainsSecret(data, options.secrets)).toBe(false);
      });

      it(`${datasetId} fetch honours AbortSignal`, async () => {
        const controller = new AbortController();
        controller.abort();
        const ctx = createTestContext(options, controller.signal);
        const start = Date.now();
        await expect(dataset.fetch(ctx)).rejects.toThrow();
        expect(Date.now() - start).toBeLessThan(100);
      });
    }
  });
}
