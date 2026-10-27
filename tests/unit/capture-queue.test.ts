import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { type CaptureJob, createCaptureQueue } from '../../lib/previews/queue';

describe('createCaptureQueue', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('takes a picture at once, then waits the gap before the next', async () => {
    const taken: number[] = [];
    const queue = createCaptureQueue(async (job) => {
      taken.push(job.tabId);
    }, 500);
    queue.request({ tabId: 1, windowId: 1 });
    queue.request({ tabId: 2, windowId: 1 });
    await vi.advanceTimersByTimeAsync(0);
    expect(taken).toEqual([1]);
    await vi.advanceTimersByTimeAsync(499);
    expect(taken).toEqual([1]);
    await vi.advanceTimersByTimeAsync(1);
    expect(taken).toEqual([1, 2]);
  });

  it('keeps only the newest request of a tab while it waits', async () => {
    const taken: CaptureJob[] = [];
    const queue = createCaptureQueue(async (job) => {
      taken.push(job);
    }, 500);
    queue.request({ tabId: 1, windowId: 1 });
    for (let i = 0; i < 10; i++) queue.request({ tabId: 2, windowId: 1 });
    queue.request({ tabId: 2, windowId: 3 });
    await vi.advanceTimersByTimeAsync(2000);
    expect(taken).toEqual([
      { tabId: 1, windowId: 1 },
      { tabId: 2, windowId: 3 },
    ]);
  });

  it('forgets the request of a closed tab', async () => {
    const taken: number[] = [];
    const queue = createCaptureQueue(async (job) => {
      taken.push(job.tabId);
    }, 500);
    queue.request({ tabId: 1, windowId: 1 });
    queue.request({ tabId: 2, windowId: 1 });
    queue.forget(2);
    await vi.advanceTimersByTimeAsync(2000);
    expect(taken).toEqual([1]);
  });

  it('goes on after a picture that failed', async () => {
    const taken: number[] = [];
    const queue = createCaptureQueue(async (job) => {
      if (job.tabId === 1) throw new Error('Chrome refused');
      taken.push(job.tabId);
    }, 500);
    queue.request({ tabId: 1, windowId: 1 });
    queue.request({ tabId: 2, windowId: 1 });
    await vi.advanceTimersByTimeAsync(2000);
    expect(taken).toEqual([2]);
  });
});
