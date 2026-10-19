import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const TERMINAL_STATUSES = new Set([
  "SUCCESS",
  "DENIED",
  "FAILED",
  "RETURNED",
  "BLOCKED",
  "CANCELED",
]);

interface StatusDetails {
  batchStatus: string;
  itemStatus: string;
  itemId?: string;
}

async function pollPayoutStatus(
  fetchDetails: () => Promise<StatusDetails>,
  options: { maxPollMs?: number; intervalMs?: number; nowFn?: () => number } = {}
) {
  const maxPollMs = options.maxPollMs ?? 60000;
  const intervalMs = options.intervalMs ?? 2500;
  const now = options.nowFn ?? (() => Date.now());

  const pollStart = now();
  let payoutBatchStatus = "PENDING";
  let payoutItemStatus = "PENDING";
  let payoutItemId = "initial-item-id";

  while (now() - pollStart < maxPollMs) {
    // Wait interval
    await new Promise((resolve) => setTimeout(resolve, intervalMs));

    try {
      const details = await fetchDetails();
      payoutBatchStatus = details.batchStatus || payoutBatchStatus;
      payoutItemStatus = details.itemStatus || payoutItemStatus;
      if (details.itemId) payoutItemId = details.itemId;
    } catch {
      // Continue polling on network hiccup
    }

    if (
      TERMINAL_STATUSES.has(payoutItemStatus.toUpperCase()) ||
      TERMINAL_STATUSES.has(payoutBatchStatus.toUpperCase())
    ) {
      break;
    }
  }

  const statusFetchedAt = new Date(now()).toISOString();
  const isTerminal =
    TERMINAL_STATUSES.has(payoutItemStatus.toUpperCase()) ||
    TERMINAL_STATUSES.has(payoutBatchStatus.toUpperCase());

  return {
    batchStatus: payoutBatchStatus,
    itemStatus: payoutItemStatus,
    itemId: payoutItemId,
    isTerminal,
    statusFetchedAt,
    elapsedMs: now() - pollStart,
  };
}

describe("A5: Payout Terminal Status Polling & Timeout Invariants", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("stops immediately when payout item reaches terminal status (SUCCESS) and records statusFetchedAt", async () => {
    let callCount = 0;
    const fetchMock = vi.fn(async () => {
      callCount++;
      if (callCount === 1) {
        return { batchStatus: "PROCESSING", itemStatus: "PENDING", itemId: "item-123" };
      }
      return { batchStatus: "SUCCESS", itemStatus: "SUCCESS", itemId: "item-123" };
    });

    const promise = pollPayoutStatus(fetchMock, { intervalMs: 1000 });

    // Advance 1s -> first poll (PENDING)
    await vi.advanceTimersByTimeAsync(1000);
    // Advance 1s -> second poll (SUCCESS)
    await vi.advanceTimersByTimeAsync(1000);

    const result = await promise;
    expect(result.isTerminal).toBe(true);
    expect(result.batchStatus).toBe("SUCCESS");
    expect(result.itemStatus).toBe("SUCCESS");
    expect(result.itemId).toBe("item-123");
    expect(result.statusFetchedAt).toBeDefined();
    expect(new Date(result.statusFetchedAt).getTime()).not.toBeNaN();
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("handles alternative terminal statuses (DENIED, FAILED, BLOCKED)", async () => {
    for (const termStatus of ["DENIED", "FAILED", "BLOCKED"]) {
      const fetchMock = vi.fn(async () => ({
        batchStatus: termStatus,
        itemStatus: termStatus,
        itemId: "item-test",
      }));

      const promise = pollPayoutStatus(fetchMock, { intervalMs: 500 });
      await vi.advanceTimersByTimeAsync(500);

      const result = await promise;
      expect(result.isTerminal).toBe(true);
      expect(result.itemStatus).toBe(termStatus);
      expect(result.statusFetchedAt).toBeDefined();
    }
  });

  it("strictly enforces 60s cap if payout remains PENDING without hanging indefinitely", async () => {
    const fetchMock = vi.fn(async () => ({
      batchStatus: "PENDING",
      itemStatus: "PENDING",
      itemId: "item-never-completes",
    }));

    const promise = pollPayoutStatus(fetchMock, { maxPollMs: 60000, intervalMs: 2500 });

    // Advance 60s in 2.5s increments
    for (let t = 0; t <= 25; t++) {
      await vi.advanceTimersByTimeAsync(2500);
    }

    const result = await promise;
    expect(result.isTerminal).toBe(false);
    expect(result.batchStatus).toBe("PENDING");
    expect(result.itemStatus).toBe("PENDING");
    expect(result.elapsedMs).toBeGreaterThanOrEqual(60000);
    expect(result.statusFetchedAt).toBeDefined();
  });
});

