import type { HttpClient } from "../lib/http.js";
import type {
  LogListParams,
  MapLogDetail,
  MapLogStatus,
  MapLogsResponse,
  ParseLogStatus,
  ParseLogsResponse,
  ScrapeLogsParams,
  ScrapeLogsResponse,
  ScrapeLogDetail,
  SearchLog,
  SearchLogStatus,
  SearchLogsResponse,
} from "../types/logs.js";

const listQuery = (params: LogListParams<string>): string => {
  const query = new URLSearchParams();
  for (const key of ["status", "searchTerm", "page", "limit", "dateStart", "dateEnd"] as const) {
    const value = params[key];
    if (value !== undefined && value !== "") query.set(key, String(value));
  }
  const qs = query.toString();
  return qs ? `?${qs}` : "";
};

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

  /** List past searches, newest first. */
  async searchLogs(params: LogListParams<SearchLogStatus> = {}): Promise<SearchLogsResponse> {
    const res = await this.http.get<{ data: SearchLogsResponse }>(`/search-logs${listQuery(params)}`);
    return res.data;
  }

  /** One past search with its results. */
  async getSearchLog(uuid: string): Promise<SearchLog> {
    const res = await this.http.get<{ data: SearchLog }>(`/search-logs/${uuid}`);
    return res.data;
  }

  /** List past maps, newest first. */
  async mapLogs(params: LogListParams<MapLogStatus> = {}): Promise<MapLogsResponse> {
    const res = await this.http.get<{ data: MapLogsResponse }>(`/map-logs${listQuery(params)}`);
    return res.data;
  }

  /** One past map with the links it returned. */
  async getMapLog(uuid: string): Promise<MapLogDetail> {
    const res = await this.http.get<{ data: MapLogDetail }>(`/map-logs/${uuid}`);
    return res.data;
  }

  /** List parsed documents, newest first. Open a result with `getParse(jobId)`. */
  async parseLogs(params: Omit<LogListParams<ParseLogStatus>, "dateStart" | "dateEnd"> = {}): Promise<ParseLogsResponse> {
    const res = await this.http.get<{ data: ParseLogsResponse }>(`/parse-logs${listQuery(params)}`);
    return res.data;
  }
}
