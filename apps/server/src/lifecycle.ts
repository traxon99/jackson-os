export type StopHook = () => void | Promise<void>;

export type LifecycleOptions = {
  exit?: (code: number) => void;
};

const HOOK_TIMEOUT_MS = 5000;
const TOTAL_SHUTDOWN_MS = 9000;

async function runHookWithTimeout(hook: StopHook): Promise<void> {
  await Promise.race([
    Promise.resolve().then(() => hook()),
    new Promise<void>((resolve) => {
      setTimeout(resolve, HOOK_TIMEOUT_MS);
    }),
  ]);
}

export function createLifecycle(options: LifecycleOptions = {}) {
  const hooks: StopHook[] = [];
  const exit = options.exit ?? ((code: number) => process.exit(code));

  function registerStopHook(hook: StopHook): void {
    hooks.push(hook);
  }

  async function shutdown(): Promise<void> {
    const startedAt = Date.now();

    for (let i = hooks.length - 1; i >= 0; i--) {
      if (Date.now() - startedAt >= TOTAL_SHUTDOWN_MS) {
        exit(1);
        return;
      }
      const hook = hooks[i];
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

  return { registerStopHook, shutdown, listenForSignals };
}
