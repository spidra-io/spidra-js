import type { HttpClient } from "../lib/http.js";
import { poll, type PollOptions } from "../lib/poll.js";
import type {
  CrawlParams,
  CrawlQueued,
  CrawlJobResponse,
  CrawlJobCompleted,
  CrawlPagesResponse,
} from "../types/crawl.js";

export class CrawlResource {
  constructor(private http: HttpClient) {}

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

  /** Re-extract data from an existing crawl with a new instruction. */
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

    const result = await poll(
      () => this.get(jobId),
      options
    );

    if (result.status === "failed") {
      throw new Error((result as { error?: string }).error ?? "Crawl job failed");
    }

    return result as CrawlJobCompleted;
  }
}
