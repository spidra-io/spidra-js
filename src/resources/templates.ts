import type { HttpClient } from "../lib/http.js";
import { poll, type PollOptions } from "../lib/poll.js";
import { SpidraJobError } from "../lib/errors.js";
import type {
  Airport,
  ListTemplateRunsParams,
  ListTemplateRunsResponse,
  ListTemplatesParams,
  ListTemplatesResponse,
  LookupAirportsParams,
  RunTemplateParams,
  TemplateDetail,
  TemplateEstimate,
  TemplateRun,
} from "../types/templates.js";

const query = (params: Record<string, string | number | undefined>) => {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== "") q.set(k, String(v));
  const s = q.toString();
  return s ? `?${s}` : "";
};

export class TemplatesResource {
  constructor(private http: HttpClient) {}

  async list(params: ListTemplatesParams = {}): Promise<ListTemplatesResponse> {
    const { templates, categories, sites } = await this.http.get<ListTemplatesResponse & { status: string }>(
      `/templates${query({ category: params.category, site: params.site, q: params.q })}`
    );
    return { templates, categories, sites };
  }

  async get(slug: string): Promise<TemplateDetail> {
    const res = await this.http.get<{ template: TemplateDetail }>(`/templates/${encodeURIComponent(slug)}`);
    return res.template;
  }

  async estimate(slug: string, params: RunTemplateParams): Promise<TemplateEstimate> {
    const { credits, note, pages } = await this.http.post<TemplateEstimate & { status: string }>(
      `/templates/${encodeURIComponent(slug)}/estimate`,
      { inputs: params.inputs }
    );
    return { credits, note, ...(pages !== undefined ? { pages } : {}) };
  }

  /** Start a run. With `wait`, a quick run comes back finished; otherwise poll `getRun()`. */
  async start(slug: string, params: RunTemplateParams & { wait?: boolean }): Promise<TemplateRun> {
    const res = await this.http.post<{ run: TemplateRun }>(`/templates/${encodeURIComponent(slug)}/runs`, {
      inputs: params.inputs,
      ...(params.wait ? { wait: true } : {}),
    });
    return res.run;
  }

  async getRun<Row = Record<string, unknown>>(runId: string, opts: { rows?: boolean } = {}): Promise<TemplateRun<Row>> {
    const res = await this.http.get<{ run: TemplateRun<Row> }>(
      `/template-runs/${runId}${opts.rows === false ? "?rows=false" : ""}`
    );
    return res.run;
  }

  /**
   * Run a template and wait for its rows. Asks the API to wait first, so a quick run often finishes in this one
   * call. A run that fails throws `SpidraJobError`; a `partial` run (some pages failed) returns with its rows and
   * `failures`.
   */
  async run<Row = Record<string, unknown>>(
    slug: string,
    params: RunTemplateParams,
    options?: PollOptions
  ): Promise<TemplateRun<Row>> {
    let run = (await this.start(slug, { ...params, wait: true })) as TemplateRun<Row>;
    if (run.status === "running") {
      const runId = run.runId;
      // poll() ends on completed/failed/cancelled, and a run can also end as "partial".
      const done = await poll(
        async () => {
          const current = await this.getRun<Row>(runId, { rows: false });
          return { status: current.status === "running" ? "running" : "completed", current };
        },
        options,
        runId
      );
      run = done.current.rows ? done.current : await this.getRun<Row>(runId);
    }
    if (run.status === "failed" || run.status === "cancelled") {
      throw new SpidraJobError(run.error ?? `Template run ${run.status}`, run.runId, run.status);
    }
    return run;
  }

  async listRuns(params: ListTemplateRunsParams = {}): Promise<ListTemplateRunsResponse> {
    const { runs, total, page } = await this.http.get<ListTemplateRunsResponse & { status: string }>(
      `/template-runs${query({ template: params.template, page: params.page, limit: params.limit })}`
    );
    return { runs, total, page };
  }

  async lookupAirports(params: LookupAirportsParams): Promise<Airport[]> {
    const res = await this.http.get<{ airports: Airport[] }>(
      `/templates/lookups/airports${query({ q: params.q, codes: params.codes?.join(","), limit: params.limit })}`
    );
    return res.airports;
  }
}
