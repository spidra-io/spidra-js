export type UsageRange = "7d" | "30d" | "weekly";

export interface UsageStatRow {
  /** Chart axis label — e.g. "Apr 16" or "Apr 14-20" */
  label: string;
  /** Tooltip date — YYYY-MM-DD for daily ranges, "Apr 14 – Apr 20" for weekly */
  date: string;
  tokens: number;
  requests: number;
  crawls: number;
  captchas: number;
  /** Average latency in milliseconds */
  latency: number;
  credits: number;
}

export interface AccountSummary {
  plan: { name: string };
  credits: {
    /** Credits available this period, including any top-up credits. */
    limit: number;
    /** Credits used this period, including credits held by jobs that are still running. */
    used: number;
    /** `limit` minus `used`, never below 0. */
    remaining: number;
    billingCycleStart: string | null;
  };
  proxyBandwidth: {
    limitMb: number;
    usedMb: number;
    remainingMb: number;
  };
  /** `null` on the free plan with no subscription. */
  subscription: { status: string } | null;
}

export type UsageBreakdownRange = "1d" | "7d" | "30d" | "custom";

export interface UsageBreakdownParams {
  range: UsageBreakdownRange;
  /** With `custom`: the first day, YYYY-MM-DD. */
  startDate?: string;
  /** With `custom`: the last day, YYYY-MM-DD. */
  endDate?: string;
}

/** Credits used on one day, split by tool. Batch scrapes count under `scrapeCredits`. */
export interface UsageBreakdownRow {
  label: string;
  date: string;
  scrapeCredits: number;
  crawlCredits: number;
  searchCredits: number;
  parseCredits: number;
  mapCredits: number;
}
