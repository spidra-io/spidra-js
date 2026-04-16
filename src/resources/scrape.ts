import type { HttpClient } from "../lib/http.js";
import { poll, type PollOptions } from "../lib/poll.js";
import type {
  ScrapeParams,
  ScrapeJobQueued,
  ScrapeJobResponse,
  ScrapeJobCompleted,
} from "../types/scrape.js";

export class ScrapeResource {
  constructor(private http: HttpClient) {}

  /** Submit a scrape job. Returns a jobId immediately. */
  submit(params: ScrapeParams): Promise<ScrapeJobQueued> {
    return this.http.post<ScrapeJobQueued>("/scrape", params);
  }

  /** Get the current status of a scrape job. */
  get(jobId: string): Promise<ScrapeJobResponse> {
    return this.http.get<ScrapeJobResponse>(`/scrape/${jobId}`);
  }

  /** Submit a scrape job and wait for it to complete. */
  async run(
    params: ScrapeParams,
    options?: PollOptions
  ): Promise<ScrapeJobCompleted> {
    const { jobId } = await this.submit(params);

    const result = await poll(
      () => this.get(jobId),
      options
    );

    if (result.status === "failed") {
      throw new Error((result as { error: string }).error ?? "Scrape job failed");
    }

    return result as ScrapeJobCompleted;
  }
}
