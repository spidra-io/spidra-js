import type { HttpClient } from "../lib/http.js";
import type { AccountSummary, UsageRange, UsageStatRow } from "../types/usage.js";

export class UsageResource {
  constructor(private http: HttpClient) {}

  /**
   * Get usage statistics for the given time range.
   *
   * - `"7d"` — last 7 days, one row per day
   * - `"30d"` — last 30 days, one row per day
   * - `"weekly"` — last 7 weeks, one row per week
   */
  async get(range: UsageRange): Promise<UsageStatRow[]> {
    const res = await this.http.get<{ status: string; data: UsageStatRow[] }>(
      `/usage-stats?range=${range}`
    );
    return res.data;
  }

  /** Get your plan, credit balance and proxy bandwidth. */
  async account(): Promise<AccountSummary> {
    const res = await this.http.get<{ status: string; data: AccountSummary }>("/account");
    return res.data;
  }
}
