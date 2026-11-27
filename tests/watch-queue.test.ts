import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createBuildQueue } from "../scripts/watch-queue.js";

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("build queue", () => {
  it("collapses a burst of events for one target into one build", async () => {
    const runs: string[] = [];
    const queue = createBuildQueue({
      debounceMs: 150,
      run: (target) => {
        runs.push(target);
      },
    });

    queue.add("a");
    queue.add("a");
    queue.add("a");
    await vi.advanceTimersByTimeAsync(150);
    await queue.whenIdle();

    expect(runs).toEqual(["a"]);
  });

  it("runs one build at a time and queues one follow-up", async () => {
    const events: string[] = [];
    let release!: () => void;
    const first = new Promise<void>((resolve) => (release = resolve));
    let calls = 0;
    const queue = createBuildQueue({
      debounceMs: 150,
      run: async (target) => {
        calls++;
        events.push(`start ${target}`);
        if (calls === 1) await first;
        events.push(`end ${target}`);
      },
    });

    queue.add("a");
    await vi.advanceTimersByTimeAsync(150);
    expect(calls).toBe(1);

    queue.add("a");
    await vi.advanceTimersByTimeAsync(150);
    expect(calls).toBe(1);

    release();
    await queue.whenIdle();
    expect(calls).toBe(2);
    expect(events).toEqual(["start a", "end a", "start a", "end a"]);
  });

  it("continues after a failed build", async () => {
    const runs: string[] = [];
    const queue = createBuildQueue({
      debounceMs: 150,
      run: (target) => {
        runs.push(target);
        if (runs.length === 1) throw new Error("the model does not build");
      },
    });

    queue.add("a");
    await vi.advanceTimersByTimeAsync(150);
    await queue.whenIdle();
    queue.add("b");
    await vi.advanceTimersByTimeAsync(150);
    await queue.whenIdle();

    expect(runs).toEqual(["a", "b"]);
  });

  it("stops starting builds after stop()", async () => {
    const runs: string[] = [];
    const queue = createBuildQueue({
      debounceMs: 150,
      run: (target) => {
        runs.push(target);
      },
    });

    queue.add("a");
    queue.stop();
    await vi.advanceTimersByTimeAsync(150);
    await queue.whenIdle();

    expect(runs).toEqual([]);
  });
});
