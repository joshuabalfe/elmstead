export interface BuildQueueOptions {
  /** How long to wait after the last change before building, so one save is one build. */
  debounceMs: number;
  /** Build one target. A rejection does not stop the queue. */
  run: (target: string) => Promise<void> | void;
}

export interface BuildQueue {
  /** Note a changed target; the build starts after the debounce window. */
  add(target: string): void;
  /** Stop starting builds. A build already running is left to finish. */
  stop(): void;
  /** Resolve once nothing is pending and no build is running. */
  whenIdle(): Promise<void>;
}

/**
 * One build at a time. Changes during a build queue a follow-up after it; targets waiting for the
 * debounce collapse into one build each.
 */
export function createBuildQueue({ debounceMs, run }: BuildQueueOptions): BuildQueue {
  const pending = new Set<string>();
  const queue: string[] = [];
  /** Targets already waiting in `queue`, so two saves during a build make one follow-up. */
  const queued = new Set<string>();
  let timer: ReturnType<typeof setTimeout> | undefined;
  let building = false;
  let stopped = false;
  const idle: (() => void)[] = [];

  const settle = () => {
    if (timer !== undefined || building || queue.length || pending.size) return;
    for (const resolve of idle.splice(0)) resolve();
  };

  const drain = async (): Promise<void> => {
    if (building || stopped) return;
    const target = queue.shift();
    if (target === undefined) {
      settle();
      return;
    }
    queued.delete(target);
    building = true;
    try {
      await run(target);
    } catch {
      // The runner reports its own failure; the next change still builds.
    } finally {
      building = false;
      if (!stopped) void drain();
      settle();
    }
  };

  const flush = () => {
    timer = undefined;
    if (stopped) return;
    for (const target of pending) {
      if (queued.has(target)) continue;
      queued.add(target);
      queue.push(target);
    }
    pending.clear();
    void drain();
  };

  return {
    add(target) {
      if (stopped) return;
      pending.add(target);
      if (timer !== undefined) clearTimeout(timer);
      timer = setTimeout(flush, debounceMs);
    },
    stop() {
      stopped = true;
      if (timer !== undefined) clearTimeout(timer);
      timer = undefined;
      pending.clear();
      queue.length = 0;
      queued.clear();
      settle();
    },
    whenIdle() {
      return new Promise<void>((resolve) => {
        idle.push(resolve);
        settle();
      });
    },
  };
}
