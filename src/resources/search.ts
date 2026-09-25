import type { HttpClient } from "../lib/http.js";
import { poll, type PollOptions } from "../lib/poll.js";
import { SpidraJobError } from "../lib/errors.js";
import type { SearchParams, SearchJobQueued, SearchJobResponse, SearchJobCompleted, SearchJobFailed } from "../types/search.js";

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
   *
   * Sends `wait: true` on the initial request -- for a plain search (no
   * `scrapeOptions`) that usually finishes in a couple seconds, the API can
   * respond with the real result in this same call, skipping the poll loop
   * below entirely. `scrapeOptions` searches (and anything that doesn't
   * finish within the API's own wait window) fall back to the normal
   * queued response automatically, and this method transparently continues
   * polling from there -- the caller never has to know which path happened.
   */
  async run(params: SearchParams, options?: PollOptions): Promise<SearchJobCompleted> {
    const submitted = await this.http.post<SearchJobQueued | SearchJobCompleted | SearchJobFailed>("/search", {
      ...params,
      wait: true,
    });

    if (submitted.status === "completed") return submitted;
    if (submitted.status === "failed") {
      throw new SpidraJobError(submitted.error ?? "Search job failed", submitted.jobId ?? "", "failed");
    }

    const { jobId } = submitted;
    const result = await poll(() => this.get(jobId), options, jobId);

    if (result.status === "failed") {
      throw new SpidraJobError(result.error ?? "Search job failed", jobId, "failed");
    }

    return result as SearchJobCompleted;
  }
}
