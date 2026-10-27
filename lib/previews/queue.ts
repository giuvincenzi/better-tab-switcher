export interface CaptureJob {
  tabId: number;
  windowId: number;
}

export interface CaptureQueue {
  /** Asks for a picture of a tab; a newer request for the same tab replaces one still waiting. */
  request: (job: CaptureJob) => void;
  /** Forgets a tab's waiting request (the tab closed). */
  forget: (tabId: number) => void;
}

/**
 * The pictures to take, one at a time and at most one every `gapMs` (Chrome allows two a second): a tab waits with
 * its newest request only, so switching fast piles nothing up. `capture` never throws into the queue.
 */
export function createCaptureQueue(capture: (job: CaptureJob) => Promise<void>, gapMs: number): CaptureQueue {
  const waiting = new Map<number, CaptureJob>();
  let running = false;
  let last = Number.NEGATIVE_INFINITY;

  async function drain() {
    if (running) return;
    running = true;
    while (waiting.size > 0) {
      const wait = last + gapMs - Date.now();
      if (wait > 0) await new Promise((done) => setTimeout(done, wait));
      const [tabId, job] = waiting.entries().next().value as [number, CaptureJob];
      waiting.delete(tabId);
      last = Date.now();
      await capture(job).catch(() => undefined);
    }
    running = false;
  }

  return {
    request(job) {
      waiting.delete(job.tabId);
      waiting.set(job.tabId, job);
      void drain();
    },
    forget(tabId) {
      waiting.delete(tabId);
    },
  };
}
