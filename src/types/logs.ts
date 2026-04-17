export interface ScrapeLogsParams {
  status?: "success" | "failed";
  searchTerm?: string;
  limit?: number;
  page?: number;
  /** Filter by channel: "api" or "playground" */
  channel?: string;
  /** ISO date string — only return logs on or after this date */
  dateStart?: string;
  /** ISO date string — only return logs on or before this date */
  dateEnd?: string;
}

export interface ScrapeLog {
  uuid: string;
  urls: Array<{ url: string }>;
  extraction_prompt: string | null;
  status: "success" | "failed";
  credits_used: number | null;
  started_at: string;
  finished_at: string | null;
  error_message: string | null;
  input_tokens: number | null;
  output_tokens: number | null;
  tokens_used: number | null;
  latency_ms: number | null;
  ai_output_format: string | null;
  use_proxy: number | null;
  proxy_country: string | null;
}

export interface ScrapeLogsResponse {
  logs: ScrapeLog[];
  total: number;
}

/** Single log entry with the full AI extraction result included. */
export interface ScrapeLogDetail extends ScrapeLog {
  result_data: unknown;
}
