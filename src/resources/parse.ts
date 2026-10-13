import type { HttpClient } from "../lib/http.js";
import { poll, type PollOptions } from "../lib/poll.js";
import { SpidraJobError } from "../lib/errors.js";
import type {
  ParseBatch,
  ParseBatchStarted,
  ParseEstimate,
  ParseInput,
  ParseJob,
  ParseOptions,
  PreparedUpload,
} from "../types/parse.js";

// Buffers can sit on a SharedArrayBuffer, which Blob won't take; copy into a plain ArrayBuffer first.
const toBlob = (file: Blob | Uint8Array | ArrayBuffer): Blob =>
  file instanceof Blob ? file : new Blob([file instanceof Uint8Array ? Uint8Array.from(file) : new Uint8Array(file)]);

/** Builds the request body: multipart for a file, JSON for a link or fileId. */
function body(input: ParseInput, options: ParseOptions & { dryRun?: boolean; wait?: boolean }): FormData | Record<string, unknown> {
  if ("file" in input) {
    const form = new FormData();
    form.append("file", toBlob(input.file), input.fileName);
    form.append("options", JSON.stringify(options));
    return form;
  }
  return { ...input, ...options };
}

export class ParseResource {
  constructor(private readonly http: HttpClient, private readonly fetchImpl: typeof fetch = globalThis.fetch) {}

  /** Pages and cost of a document, without parsing or charging. The returned fileId can be parsed for 24 hours. */
  estimate(input: ParseInput, options: ParseOptions = {}): Promise<ParseEstimate> {
    return this.http.post<ParseEstimate>("/parse", body(input, { ...options, dryRun: true }));
  }

  /** Queues a document and returns at once with its jobId. */
  start<T = unknown>(input: ParseInput, options: ParseOptions = {}): Promise<ParseJob<T>> {
    return this.http.post<ParseJob<T>>("/parse", body(input, { ...options, wait: false }));
  }

  /** A parse job's status, and its result once completed. */
  get<T = unknown>(jobId: string, opts: { includePages?: boolean } = {}): Promise<ParseJob<T>> {
    return this.http.get<ParseJob<T>>(`/parse/${encodeURIComponent(jobId)}${opts.includePages ? "?pages=true" : ""}`);
  }

  /**
   * Parses a document and waits for the result. Short documents answer in the same request; longer ones are polled
   * until they finish. Throws SpidraJobError if the document can't be parsed.
   */
  async run<T = unknown>(input: ParseInput, options: ParseOptions = {}, pollOptions?: PollOptions): Promise<ParseJob<T>> {
    let job = await this.http.post<ParseJob<T>>("/parse", body(input, { ...options, wait: true }));
    if (job.status === "queued" || job.status === "running") {
      job = await poll(() => this.get<T>(job.jobId, { includePages: options.includePages }), { pollInterval: 2000, ...pollOptions }, job.jobId);
    }
    if (job.status === "failed") throw new SpidraJobError(job.error ?? "The document couldn't be parsed", job.jobId, "failed");
    return job;
  }

  /** Queues several documents (files, links or fileIds), one job each. */
  startBatch(inputs: ParseInput[], options: ParseOptions = {}): Promise<ParseBatchStarted> {
    const files = inputs.filter((i): i is Extract<ParseInput, { file: unknown }> => "file" in i);
    const urls = inputs.filter((i): i is { url: string } => "url" in i).map(i => i.url);
    const fileIds = inputs.filter((i): i is { fileId: string } => "fileId" in i).map(i => i.fileId);
    if (files.length) {
      const form = new FormData();
      for (const f of files) form.append("files", toBlob(f.file), f.fileName);
      if (urls.length) form.append("urls", JSON.stringify(urls));
      if (fileIds.length) form.append("fileIds", JSON.stringify(fileIds));
      form.append("options", JSON.stringify(options));
      return this.http.post<ParseBatchStarted>("/parse/batch", form);
    }
    return this.http.post<ParseBatchStarted>("/parse/batch", { urls, fileIds, ...options });
  }

  getBatch<T = unknown>(batchId: string, opts: { includeResults?: boolean } = {}): Promise<ParseBatch<T>> {
    return this.http.get<ParseBatch<T>>(`/parse/batch/${encodeURIComponent(batchId)}${opts.includeResults ? "?include=results" : ""}`);
  }

  /** Parses several documents and waits for all of them. Failed documents come back with status "failed" and an error. */
  async runBatch<T = unknown>(inputs: ParseInput[], options: ParseOptions = {}, pollOptions?: PollOptions): Promise<ParseBatch<T>> {
    const started = await this.startBatch(inputs, options);
    await poll(
      async () => {
        const b = await this.getBatch(started.batchId);
        return { status: b.status === "completed" ? "completed" : "running" };
      },
      { pollInterval: 2000, ...pollOptions },
      started.batchId
    );
    return this.getBatch<T>(started.batchId, { includeResults: true });
  }

  /** Uploads a large file (up to 500 MB) and returns its fileId, for parse({ fileId }). */
  async upload(file: Blob | Uint8Array | ArrayBuffer, fileName: string): Promise<{ fileId: string }> {
    const blob = toBlob(file);
    const prepared = await this.http.post<PreparedUpload>("/parse/uploads", { fileName, size: blob.size });
    const res = await this.fetchImpl(prepared.uploadUrl, { method: "PUT", body: blob });
    if (!res.ok) throw new Error(`Upload failed with HTTP ${res.status}`);
    return { fileId: prepared.fileId };
  }

  /** Deletes an uploaded file now instead of after 24 hours. */
  deleteFile(fileId: string): Promise<{ status: "deleted"; fileId: string }> {
    return this.http.delete(`/parse/files/${encodeURIComponent(fileId)}`);
  }
}
