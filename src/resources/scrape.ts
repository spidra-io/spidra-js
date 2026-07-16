import type { HttpClient } from "../lib/http.js";
import { poll, type PollOptions } from "../lib/poll.js";
import { SpidraJobError } from "../lib/errors.js";
import { resolveSchemaParam, type InferSchemaOutput, type SchemaInput } from "../lib/schema.js";
import type {
  ScrapeParams,
  ScrapeJobQueued,
  ScrapeJobResponse,
  ScrapeJobCompleted,
} from "../types/scrape.js";

export class ScrapeResource {
  constructor(private http: HttpClient) {}

  /** Submit a scrape job. Returns a jobId immediately. */
  async submit(params: ScrapeParams): Promise<ScrapeJobQueued> {
    return this.http.post<ScrapeJobQueued>("/scrape", await resolveSchemaParam(params));
  }

  /** Get the current status of a scrape job. */
  get<T = unknown>(jobId: string): Promise<ScrapeJobResponse<T>> {
    return this.http.get<ScrapeJobResponse<T>>(`/scrape/${jobId}`);
  }

  /**
   * Submit a scrape job and wait for it to complete.
   * Throws `SpidraJobError` if the job fails, and `SpidraTimeoutError` if
   * `options.timeout` is set and exceeded.
   */
  async run<S extends SchemaInput = Record<string, unknown>>(
    params: ScrapeParams<S>,
    options?: PollOptions
  ): Promise<ScrapeJobCompleted<InferSchemaOutput<S>>> {
    const { jobId } = await this.submit(params);

    const result = await poll(() => this.get<InferSchemaOutput<S>>(jobId), options, jobId);

    if (result.status === "failed") {
      throw new SpidraJobError(result.error ?? "Scrape job failed", jobId, "failed");
    }

    return result as ScrapeJobCompleted<InferSchemaOutput<S>>;
  }
}
