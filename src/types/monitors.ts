import type { TemplateSite } from "./templates.js";

/** What a monitor runs on each check. */
export type MonitorSource =
  | { id?: string; kind: "template"; template: string; inputs: Record<string, unknown>; label?: string }
  | { id?: string; kind: "preset"; presetId: string; label?: string }
  | { id?: string; kind: "urls"; urls: string[]; label?: string };

/** Use `every`, or `cron`. `at` is "HH:MM" in `timezone`; `day` is the weekday for `1w` (0 is Sunday). */
export interface MonitorSchedule {
  every?: "5m" | "15m" | "30m" | "1h" | "6h" | "12h" | "1d" | "1w";
  at?: string;
  day?: number;
  cron?: string;
  /** An IANA time zone, such as "Africa/Lagos". */
  timezone?: string;
}

export type MonitorAlertOn = "new" | "changed" | "removed" | "page" | "every";

/** Alert only when a field passes a threshold, such as price below 25. */
export interface MonitorRule {
  field: string;
  op: "lt" | "lte" | "gt" | "gte" | "eq" | "neq" | "contains" | "drops_by_pct" | "rises_by_pct";
  value: number | string;
}

export interface MonitorNotify {
  /** Your account's address unless `enabled` is false. Extra recipients get alerts after confirming by email. */
  email?: { enabled?: boolean; recipients?: string[] };
  /** Signed with HMAC-SHA256 in `X-Spidra-Signature`. A secret is made for you if you leave it out. */
  webhook?: { url: string; secret?: string };
  slack?: { webhookUrl: string };
  discord?: { webhookUrl: string };
}

export interface MonitorParams {
  name?: string;
  sources: MonitorSource[];
  schedule?: MonitorSchedule;
  /** What counts as a change worth an alert. */
  alertOn?: MonitorAlertOn;
  /** For `changed`: only these fields count. */
  watchFields?: string[];
  rule?: MonitorRule | null;
  /** In plain words, what matters. AI reads each change against it and only meaningful ones alert. */
  goal?: string | null;
  notify?: MonitorNotify;
}

export interface CreateMonitorParams extends MonitorParams {
  /** Run the first check now to record the starting point (default true). */
  checkNow?: boolean;
}

export type UpdateMonitorParams = Partial<MonitorParams>;

export interface Monitor {
  id: string;
  name: string;
  status: "active" | "paused";
  sources: Array<MonitorSource & { id: string; label: string; site?: TemplateSite | null }>;
  schedule: MonitorSchedule;
  cron: string;
  alertOn: MonitorAlertOn;
  watchFields: string[];
  rule: MonitorRule | null;
  goal: string | null;
  notify: MonitorNotify;
  /** UTC. `null` while paused. */
  nextRunAt: string | null;
  lastCheckAt: string | null;
  lastChangeAt: string | null;
  lastStatus: "completed" | "partial" | "failed" | null;
  lastSummary: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface MonitorRecipient {
  email: string;
  status: "pending" | "confirmed" | "unsubscribed";
}

export interface MonitorWriteResponse {
  monitor: Monitor;
  /** Extra email recipients and whether they've confirmed. */
  recipients: MonitorRecipient[];
}

export interface MonitorEstimate {
  creditsPerCheck: number;
  checksPerMonth: number;
  creditsPerMonth: number;
  /** True when a source extracts with AI, which adds AI credits on top. */
  usesAi: boolean;
}

export interface MonitorLimits {
  plan: string;
  /** The shortest time allowed between checks on your plan. */
  minIntervalMinutes: number;
  maxMonitors: number;
  /** Monitors you have now, paused ones included. */
  used: number;
}

export interface TestNotificationParams {
  notify: MonitorNotify;
  name?: string;
}

export interface TestNotificationResponse {
  /** `partial` when a channel couldn't be reached; `errors` says which and why. */
  status: "success" | "partial";
  sent: number;
  errors: string[];
}

export interface MonitorItemChange {
  key: string;
  item: Record<string, unknown>;
  fields: Array<{ field: string; previous: unknown; current: unknown }>;
}

/** What changed in one source during a check. */
export interface MonitorSourceChanges {
  sourceId: string;
  label: string;
  /** The source's first check: it records the starting point and doesn't alert. */
  baseline: boolean;
  added: Record<string, unknown>[];
  removed: Record<string, unknown>[];
  changed: MonitorItemChange[];
  /** Page text changes, for `urls` sources. */
  pages: Array<{ url: string; added: string[]; removed: string[] }>;
  rows?: Record<string, unknown>[];
  rowCount?: number;
  error?: string;
}

export interface MonitorCheck {
  id: string;
  trigger: "schedule" | "manual";
  status: "running" | "completed" | "partial" | "failed" | "skipped";
  startedAt: string;
  finishedAt: string | null;
  creditsUsed: number | null;
  hasChanges: boolean;
  summary: string | null;
  /** False when no alert went out, for example when the goal judged the change not meaningful. */
  notified: boolean;
  /** Set when the monitor has a goal and something changed. */
  judgment: { meaningful: boolean; reason: string } | null;
  error: string | null;
  /** Only on `getMonitorCheck()`. */
  sources?: MonitorSourceChanges[];
}

export interface ListMonitorChecksParams {
  page?: number;
  limit?: number;
}

export interface ListMonitorChecksResponse {
  checks: MonitorCheck[];
  total: number;
  page: number;
}
