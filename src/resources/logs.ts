import type { HttpClient } from "../lib/http.js";
import type { ScrapeLogsParams, ScrapeLogsResponse } from "../types/logs.js";

export class LogsResource {
  constructor(private http: HttpClient) {}

  list(params: ScrapeLogsParams = {}): Promise<ScrapeLogsResponse> {
    const query = new URLSearchParams();
    if (params.status) query.set("status", params.status);
    if (params.searchTerm) query.set("searchTerm", params.searchTerm);
    if (params.limit != null) query.set("limit", String(params.limit));
    if (params.page != null) query.set("page", String(params.page));

    const qs = query.toString();
    return this.http.get<ScrapeLogsResponse>(`/scrape-logs${qs ? `?${qs}` : ""}`);
  }
}
