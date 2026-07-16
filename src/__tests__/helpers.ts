import { vi } from "vitest";

export function jsonResponse(
  status: number,
  body: unknown,
  headers: Record<string, string> = {}
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json", ...headers },
  });
}

type FetchStep = Response | Error | (() => Response | Error);

/**
 * Builds a fetch mock that plays back `steps` in order. A step that is an
 * Error is thrown (network failure); the last step repeats if fetch is
 * called more times than there are steps.
 */
export function sequenceFetch(...steps: FetchStep[]) {
  let call = 0;
  return vi.fn(async (): Promise<Response> => {
    const step = steps[Math.min(call++, steps.length - 1)];
    const resolved = typeof step === "function" ? step() : step;
    if (resolved instanceof Error) throw resolved;
    // Response bodies can only be read once — clone so a repeated last step works
    return resolved.clone();
  }) as unknown as typeof fetch & ReturnType<typeof vi.fn>;
}

export function networkError(): TypeError {
  return new TypeError("fetch failed");
}

/** Awaits a promise that must reject and returns the error, loosely typed for assertions. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function catchError(promise: Promise<unknown>): Promise<any> {
  let caught: unknown;
  let rejected = false;
  try {
    await promise;
  } catch (e) {
    caught = e;
    rejected = true;
  }
  if (!rejected) throw new Error("expected promise to reject");
  return caught;
}
