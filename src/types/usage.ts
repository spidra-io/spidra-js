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
