import { describe, expect, it, vi } from "vitest";
import { catchError } from "./helpers.js";
import { poll } from "../lib/poll.js";
import {
  SpidraAuthenticationError,
  SpidraRateLimitError,
  SpidraServerError,
  SpidraTimeoutError,
} from "../lib/errors.js";

function statuses(...sequence: string[]) {
  let call = 0;
  return vi.fn(async () => ({ status: sequence[Math.min(call++, sequence.length - 1)] }));
}

describe("poll", () => {
  it("resolves when the job reaches a terminal status", async () => {
    const fn = statuses("waiting", "active", "completed");
    const result = await poll(fn, { pollInterval: 1 });
    expect(result.status).toBe("completed");
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("returns failed/cancelled results instead of looping forever", async () => {
    expect((await poll(statuses("active", "failed"), { pollInterval: 1 })).status).toBe("failed");
    expect((await poll(statuses("cancelled"), { pollInterval: 1 })).status).toBe("cancelled");
  });

  it("waits indefinitely by default (no 2-minute ceiling)", async () => {
    // 80 non-terminal polls at the old logic's boundary behavior — the old
    // default would only allow ~40 polls at 3s; here we just prove there is
    // no iteration-count/timeout cliff when timeout is unset.
    const sequence = [...Array(80).fill("active"), "completed"];
    const result = await poll(statuses(...sequence), { pollInterval: 0 });
    expect(result.status).toBe("completed");
  });

  it("throws SpidraTimeoutError with the jobId when timeout is set and exceeded", async () => {
    const err = await catchError(poll(statuses("active"), { pollInterval: 5, timeout: 12 }, "job-42"));
    expect(err).toBeInstanceOf(SpidraTimeoutError);
    expect(err.jobId).toBe("job-42");
    expect(err.timeoutMs).toBe(12);
    expect(err.message).toContain("job-42");
    expect(err.message).toContain("still running server-side");
  });

  it("polls through transient errors", async () => {
    let call = 0;
    const fn = vi.fn(async () => {
      call++;
      if (call <= 2) throw new SpidraServerError("blip", 502);
      return { status: "completed" };
    });
    const result = await poll(fn, { pollInterval: 1 });
    expect(result.status).toBe("completed");
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it("gives up after maxConsecutiveErrors transient errors", async () => {
    const fn = vi.fn(async () => {
      throw new SpidraServerError("down", 503);
    });
    await expect(poll(fn, { pollInterval: 1, maxConsecutiveErrors: 2 })).rejects.toBeInstanceOf(SpidraServerError);
    expect(fn).toHaveBeenCalledTimes(3); // tolerated 2, threw on the 3rd
  });

  it("resets the consecutive-error count after a successful poll", async () => {
    let call = 0;
    const fn = vi.fn(async () => {
      call++;
      // errors on calls 1-2, success 3, errors 4-5, success 6 (terminal)
      if (call <= 2 || call === 4 || call === 5) throw new SpidraServerError("blip", 502);
      if (call === 3) return { status: "active" };
      return { status: "completed" };
    });
    const result = await poll(fn, { pollInterval: 1, maxConsecutiveErrors: 2 });
    expect(result.status).toBe("completed");
  });

  it("throws non-retryable errors immediately", async () => {
    const fn = vi.fn(async () => {
      throw new SpidraAuthenticationError("bad key");
    });
    await expect(poll(fn, { pollInterval: 1 })).rejects.toBeInstanceOf(SpidraAuthenticationError);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it("waits out the rate-limit window when a 429 carries retryAfterMs", async () => {
    let call = 0;
    const fn = vi.fn(async () => {
      call++;
      if (call === 1) throw new SpidraRateLimitError("limited", { retryAfterMs: 40 });
      return { status: "completed" };
    });
    const start = Date.now();
    await poll(fn, { pollInterval: 1 });
    expect(Date.now() - start).toBeGreaterThanOrEqual(35);
  });

  it("rejects when the signal is aborted mid-poll", async () => {
    const controller = new AbortController();
    const fn = statuses("active");
    const pending = poll(fn, { pollInterval: 1000, signal: controller.signal });
    const assertion = expect(pending).rejects.toMatchObject({ name: "AbortError" });
    setTimeout(() => controller.abort(), 10);
    await assertion;
  });
});
