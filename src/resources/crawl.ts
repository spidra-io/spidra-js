import type { HttpClient } from "../lib/http.js";
import { poll, type PollOptions } from "../lib/poll.js";
import type {
  CrawlParams,
  CrawlQueued,
  CrawlJobResponse,
  CrawlJobCompleted,
  CrawlPagesResponse,
  CrawlHistoryParams,
  CrawlHistoryResponse,
  CrawlStats,
} from "../types/crawl.js";

export class CrawlResource {
  constructor(private http: HttpClient) {}

  /** List past crawl jobs for the authenticated user, newest first. */
  history(params: CrawlHistoryParams = {}): Promise<CrawlHistoryResponse> {
    const query = new URLSearchParams();
    if (params.page != null) query.set("page", String(params.page));
    if (params.limit != null) query.set("limit", String(params.limit));
    const qs = query.toString();
    return this.http.get<CrawlHistoryResponse>(`/crawl/history${qs ? `?${qs}` : ""}`);
  }

  /** Get total crawl job count for the authenticated user. */
  stats(): Promise<CrawlStats> {
    return this.http.get<CrawlStats>("/crawl/stats");
  }

  /** Submit a crawl job. Returns a jobId immediately. */
  submit(params: CrawlParams): Promise<CrawlQueued> {
    return this.http.post<CrawlQueued>("/crawl", params);
  }

  /** Get the current status of a crawl job. */
  get(jobId: string): Promise<CrawlJobResponse> {
    return this.http.get<CrawlJobResponse>(`/crawl/${jobId}`);
  }

  /** Get crawled pages with signed download URLs. */
  pages(jobId: string): Promise<CrawlPagesResponse> {
    return this.http.get<CrawlPagesResponse>(`/crawl/${jobId}/pages`);
  }

  /** Re-extract data from an existing crawl with a new transform instruction (no re-crawling). */
  extract(jobId: string, transformInstruction: string): Promise<CrawlQueued> {
    return this.http.post<CrawlQueued>(`/crawl/${jobId}/extract`, {
      transformInstruction,
    });
  }

  /** Submit a crawl job and wait for it to complete. */
  async run(
    params: CrawlParams,
    options?: PollOptions
  ): Promise<CrawlJobCompleted> {
    const { jobId } = await this.submit(params);

    const result = await poll(() => this.get(jobId), options);

    if (result.status === "failed") {
      throw new Error((result as { error?: string }).error ?? "Crawl job failed");
    }

    return result as CrawlJobCompleted;
  }
}
