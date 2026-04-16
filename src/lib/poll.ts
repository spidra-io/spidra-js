export interface PollOptions {
  /** How often to check for a result, in ms. Default: 3000 */
  pollInterval?: number;
  /** Max time to wait before throwing, in ms. Default: 120000 (2 min) */
  timeout?: number;
}

const TERMINAL_STATUSES = ["completed", "failed", "cancelled"] as const;
type TerminalStatus = (typeof TERMINAL_STATUSES)[number];

export async function poll<T extends { status: string }>(
  fn: () => Promise<T>,
  options: PollOptions = {}
): Promise<T> {
  const { pollInterval = 3000, timeout = 120_000 } = options;
  const deadline = Date.now() + timeout;

  while (true) {
    const result = await fn();

    if (TERMINAL_STATUSES.includes(result.status as TerminalStatus)) {
      return result;
    }

    if (Date.now() + pollInterval > deadline) {
      throw new Error(`Spidra job timed out after ${timeout}ms`);
    }

    await sleep(pollInterval);
  }
}

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}
