import type { HttpClient } from "../lib/http.js";
import { poll, type PollOptions } from "../lib/poll.js";
import { SpidraJobError } from "../lib/errors.js";
import type { SearchParams, SearchJobQueued, SearchJobResponse, SearchJobCompleted } from "../types/search.js";

export class SearchResource {
  constructor(private http: HttpClient) {}

  /** Submit a search job. Returns a jobId immediately. */
  submit(params: SearchParams): Promise<SearchJobQueued> {
    return this.http.post<SearchJobQueued>("/search", params);
  }

  /** Get the current status of a search job. */
  get(jobId: string): Promise<SearchJobResponse> {
    return this.http.get<SearchJobResponse>(`/search/${jobId}`);
  }

  /**
   * Submit a search job and wait for it to complete.
   * Throws `SpidraJobError` if the job fails, and `SpidraTimeoutError` if
   * `options.timeout` is set and exceeded.
   */
  async run(params: SearchParams, options?: PollOptions): Promise<SearchJobCompleted> {
    const { jobId } = await this.submit(params);

    const result = await poll(() => this.get(jobId), options, jobId);

    if (result.status === "failed") {
      throw new SpidraJobError(result.error ?? "Search job failed", jobId, "failed");
    }

    return result as SearchJobCompleted;
  }
}
