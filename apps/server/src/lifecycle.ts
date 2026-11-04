export type LifecycleHook = () => void | Promise<void>;

export type LifecycleOptions = {
  exit?: (code: number) => void;
};

const HOOK_TIMEOUT_MS = 5000;
const TOTAL_SHUTDOWN_MS = 9000;

async function runHookWithTimeout(hook: LifecycleHook): Promise<void> {
  await Promise.race([
    Promise.resolve().then(() => hook()),
    new Promise<void>((resolve) => {
      setTimeout(resolve, HOOK_TIMEOUT_MS);
    }),
  ]);
}

export type Lifecycle = ReturnType<typeof createLifecycle>;

export function createLifecycle(options: LifecycleOptions = {}) {
  const startHooks: LifecycleHook[] = [];
  const stopHooks: LifecycleHook[] = [];
  const exit = options.exit ?? ((code: number) => process.exit(code));

  function registerStartHook(hook: LifecycleHook): void {
    startHooks.push(hook);
  }

  function registerStopHook(hook: LifecycleHook): void {
    stopHooks.push(hook);
  }

  async function runStartHooks(): Promise<void> {
    for (const hook of startHooks) {
      await runHookWithTimeout(hook);
    }
  }

  async function shutdown(): Promise<void> {
    const startedAt = Date.now();

    for (let i = stopHooks.length - 1; i >= 0; i--) {
      if (Date.now() - startedAt >= TOTAL_SHUTDOWN_MS) {
        exit(1);
        return;
      }
      const hook = stopHooks[i];
      if (hook === undefined) {
        continue;
      }
      await runHookWithTimeout(hook);
    }
    exit(0);
  }

  function listenForSignals(): void {
    const onSignal = () => {
      void shutdown();
    };
    process.once('SIGTERM', onSignal);
    process.once('SIGINT', onSignal);
  }

  return {
    registerStartHook,
    registerStopHook,
    runStartHooks,
    shutdown,
    listenForSignals,
  };
}
