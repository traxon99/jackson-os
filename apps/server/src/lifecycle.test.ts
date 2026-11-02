import { afterEach, describe, expect, it, vi } from 'vitest';
import { createLifecycle } from './lifecycle.js';

const HOOK_TIMEOUT_MS = 5000;

describe('createLifecycle', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('runs stop hooks in reverse registration order', async () => {
    const order: string[] = [];
    let exitCode: number | undefined;
    const lifecycle = createLifecycle({
      exit: (code) => {
        exitCode = code;
      },
    });

    lifecycle.registerStopHook(async () => {
      order.push('a');
    });
    lifecycle.registerStopHook(async () => {
      order.push('b');
    });
    lifecycle.registerStopHook(async () => {
      order.push('c');
    });

    await lifecycle.shutdown();

    expect(order).toEqual(['c', 'b', 'a']);
    expect(exitCode).toBe(0);
  });

  it('continues after a hook exceeds the per-hook timeout', async () => {
    vi.useFakeTimers();
    const order: string[] = [];
    let exitCode: number | undefined;
    const lifecycle = createLifecycle({
      exit: (code) => {
        exitCode = code;
      },
    });

    lifecycle.registerStopHook(async () => {
      order.push('first');
    });
    lifecycle.registerStopHook(() => {
      order.push('hang');
      return new Promise<void>(() => {});
    });
    lifecycle.registerStopHook(async () => {
      order.push('last');
    });

    const shuttingDown = lifecycle.shutdown();
    await vi.advanceTimersByTimeAsync(HOOK_TIMEOUT_MS);
    await shuttingDown;

    expect(order).toEqual(['last', 'hang', 'first']);
    expect(exitCode).toBe(0);
  });
});
