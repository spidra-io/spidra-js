import type { HttpClient } from "../lib/http.js";
import type { ScrapeLogsParams, ScrapeLogsResponse, ScrapeLogDetail } from "../types/logs.js";

export class LogsResource {
  constructor(private http: HttpClient) {}

  /** List scrape logs for the authenticated user with optional filters. */
  async list(params: ScrapeLogsParams = {}): Promise<ScrapeLogsResponse> {
    const query = new URLSearchParams();
    if (params.status) query.set("status", params.status);
    if (params.searchTerm) query.set("searchTerm", params.searchTerm);
    if (params.limit != null) query.set("limit", String(params.limit));
    if (params.page != null) query.set("page", String(params.page));
    if (params.channel) query.set("channel", params.channel);
    if (params.dateStart) query.set("dateStart", params.dateStart);
    if (params.dateEnd) query.set("dateEnd", params.dateEnd);

    const qs = query.toString();
    const res = await this.http.get<{ status: string; data: ScrapeLogsResponse }>(
      `/scrape-logs${qs ? `?${qs}` : ""}`
    );
    return res.data;
  }

  /** Get a single scrape log by its UUID, including the full AI extraction result. */
  async get(uuid: string): Promise<ScrapeLogDetail> {
    const res = await this.http.get<{ status: string; data: ScrapeLogDetail }>(
      `/scrape-logs/${uuid}`
    );
    return res.data;
  }
}
