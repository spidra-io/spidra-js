import { HttpClient } from "./lib/http.js";
import { ScrapeResource } from "./resources/scrape.js";
import { BatchResource } from "./resources/batch.js";
import { BulkResource } from "./resources/bulk.js";
import { CrawlResource } from "./resources/crawl.js";
import { ParseResource } from "./resources/parse.js";
import type { ParseBatch, ParseEstimate, ParseInput, ParseJob, ParseOptions } from "./types/parse.js";
import { LogsResource } from "./resources/logs.js";
import { UsageResource } from "./resources/usage.js";
import { SearchResource } from "./resources/search.js";
import { CrawlWatcher, BatchWatcher, type WatchOptions } from "./lib/watcher.js";
import { poll, type PollOptions } from "./lib/poll.js";
import type { InferSchemaOutput, SchemaInput } from "./lib/schema.js";
import type { SpidraConfig } from "./types/client.js";
import type {
  ScrapeParams,
  ScrapeResult,
  ScrapeJobQueued,
  ScrapeJobResponse,
} from "./types/scrape.js";
import type {
  BatchScrapeParams,
  BatchScrapeQueued,
  BatchScrapeResponse,
  BatchCancelResponse,
  BatchListParams,
  BatchRetryParams,
  BatchRetryResponse,
  BatchListResponse,
} from "./types/batch.js";
import type {
  CrawlParams,
  CrawlQueued,
  CrawlJobCompleted,
  CrawlJobResponse,
  CrawlPagesResponse,
  CrawlHistoryParams,
  CrawlHistoryResponse,
  CrawlStats,
  CrawlCancelResponse,
  CrawlJobDetails,
  CrawlRetryPageResponse,
  CrawlReportParams,
  CrawlReportResponse,
  CrawlPagesParams,
  MapParams,
  MapResult,
} from "./types/crawl.js";
import type { SearchParams, SearchResult, SearchJobQueued, SearchJobResponse } from "./types/search.js";
import type { BulkEstimate, BulkScrapeParams, BulkResult } from "./types/bulk.js";
import type { ScrapeLogsParams, ScrapeLogsResponse, ScrapeLogDetail } from "./types/logs.js";
import type { AccountSummary, UsageRange, UsageStatRow } from "./types/usage.js";

/**
 * The Spidra client. Every method that submits a job comes in three shapes:
 * the bare verb (e.g. `scrape()`) submits and waits for the result, `start*`
 * submits and returns immediately with a job id, and `get*` checks status.
 */
export class SpidraClient {
  private scrapeResource: ScrapeResource;
  private batchResource: BatchResource;
  private bulkResource: BulkResource;
  private crawlResource: CrawlResource;
  private logsResource: LogsResource;
  private usageResource: UsageResource;
  private searchResource: SearchResource;
  private parseResource: ParseResource;

  constructor(config: SpidraConfig) {
    const http = new HttpClient(config);
    this.scrapeResource = new ScrapeResource(http);
    this.batchResource = new BatchResource(http);
    this.bulkResource = new BulkResource(this.batchResource);
    this.crawlResource = new CrawlResource(http);
    this.logsResource = new LogsResource(http);
    this.usageResource = new UsageResource(http);
    this.searchResource = new SearchResource(http);
    this.parseResource = new ParseResource(http, config.fetch ?? globalThis.fetch);
  }

  // ---- Parse -----------------------------------------------------------

  /**
   * Parse a document (a file's bytes, a link, or a fileId) into Markdown, and optionally extract JSON with a prompt
   * or schema. Waits for the result. 1 credit per page.
   *
   * ```ts
   * const doc = await spidra.parse({ file: await readFile("report.pdf"), fileName: "report.pdf" }, { pages: "1-10" });
   * console.log(doc.markdown);
   * ```
   */
  parse<T = unknown>(input: ParseInput, options?: ParseOptions, pollOptions?: PollOptions): Promise<ParseJob<T>> {
    return this.parseResource.run<T>(input, options, pollOptions);
  }

  /** Queue a document to parse and return at once with its jobId. */
  startParse<T = unknown>(input: ParseInput, options?: ParseOptions): Promise<ParseJob<T>> {
    return this.parseResource.start<T>(input, options);
  }

  /** A parse job's status, and its result once completed. */
  getParse<T = unknown>(jobId: string, opts?: { includePages?: boolean }): Promise<ParseJob<T>> {
    return this.parseResource.get<T>(jobId, opts);
  }

  /** Pages and cost of a document, without parsing it or charging. */
  estimateParse(input: ParseInput, options?: ParseOptions): Promise<ParseEstimate> {
    return this.parseResource.estimate(input, options);
  }

  /** Parse several documents and wait for all of them. */
  parseBatch<T = unknown>(inputs: ParseInput[], options?: ParseOptions, pollOptions?: PollOptions): Promise<ParseBatch<T>> {
    return this.parseResource.runBatch<T>(inputs, options, pollOptions);
  }

  /** Upload a large file (up to 500 MB) and get a fileId to parse. */
  uploadForParse(file: Blob | Uint8Array | ArrayBuffer, fileName: string): Promise<{ fileId: string }> {
    return this.parseResource.upload(file, fileName);
  }

  /** Delete an uploaded file now instead of after 24 hours. */
  deleteParseFile(fileId: string): Promise<{ status: "deleted"; fileId: string }> {
    return this.parseResource.deleteFile(fileId);
  }

  // ---- Scrape ----------------------------------------------------------

  /** Scrape one or more URLs and wait for the result. */
  async scrape<S extends SchemaInput = Record<string, unknown>>(
    params: ScrapeParams<S>,
    options?: PollOptions
  ): Promise<ScrapeResult<InferSchemaOutput<S>>> {
    const job = await this.scrapeResource.run<S>(params, options);
    return job.result;
  }

  /** Submit a scrape job and return immediately without waiting. */
  startScrape(params: ScrapeParams): Promise<ScrapeJobQueued> {
    return this.scrapeResource.submit(params);
  }

  /** Get the current status of a scrape job. */
  getScrape<T = unknown>(jobId: string): Promise<ScrapeJobResponse<T>> {
    return this.scrapeResource.get<T>(jobId);
  }

  // ---- Batch -------------------------------------------------------------

  /** Batch scrape URLs and wait for all to complete. */
  batchScrape<S extends SchemaInput = Record<string, unknown>>(
    params: BatchScrapeParams<S>,
    options?: PollOptions
  ): Promise<BatchScrapeResponse<InferSchemaOutput<S>>> {
    return this.batchResource.run<S>(params, options);
  }

  /**
   * Scrape one URL template across lists of values (every title in every city, say) and get back
   * one merged list with duplicates removed. Each page costs 1 credit, plus AI tokens if you set a
   * prompt or schema. Call `estimateBulk` first to see the cost.
   */
  bulkScrape<T = Record<string, unknown>>(params: BulkScrapeParams, options?: PollOptions): Promise<BulkResult<T>> {
    return this.bulkResource.run<T>(params, options);
  }

  /** How many pages and credits a bulk search would use, without running it. */
  estimateBulk(params: BulkScrapeParams): BulkEstimate {
    return this.bulkResource.estimate(params);
  }

  /** Submit a batch scrape and return immediately without waiting. */
  startBatchScrape(params: BatchScrapeParams): Promise<BatchScrapeQueued> {
    return this.batchResource.submit(params);
  }

  /** Get the current status of a batch scrape job. */
  getBatchScrape<T = unknown>(batchId: string): Promise<BatchScrapeResponse<T>> {
    return this.batchResource.get<T>(batchId);
  }

  /** Cancel a pending or active batch. Credits for unprocessed items are refunded. */
  cancelBatchScrape(batchId: string): Promise<BatchCancelResponse> {
    return this.batchResource.cancel(batchId);
  }

  /** Retry failed items in a batch. */
  retryBatchScrape(batchId: string, params?: BatchRetryParams): Promise<BatchRetryResponse> {
    return this.batchResource.retry(batchId, params);
  }

  /** List past batch scrape jobs, newest first. */
  listBatchScrapes(params?: BatchListParams): Promise<BatchListResponse> {
    return this.batchResource.list(params);
  }

  /**
   * Watch a batch job, receiving each item as it finishes:
   *
   * ```ts
   * const watcher = client.watchBatch(batchId);
   * watcher.on("item", (item) => console.log(item.url, item.status));
   * const final = await watcher.wait();
   * ```
   */
  watchBatch<T = unknown>(batchId: string, options?: WatchOptions): BatchWatcher<T> {
    return new BatchWatcher<T>(this.batchResource, batchId, options);
  }

  // ---- Crawl ---------------------------------------------------------

  /** Crawl a website and wait for all pages to be processed. */
  async crawl<S extends SchemaInput = Record<string, unknown>>(
    params: CrawlParams<S>,
    options?: PollOptions
  ): Promise<CrawlJobCompleted<InferSchemaOutput<S>>> {
    return this.crawlResource.run<S>(params, options);
  }

  /** Submit a crawl job and return immediately without waiting. */
  startCrawl(params: CrawlParams): Promise<CrawlQueued> {
    return this.crawlResource.submit(params);
  }

  /** Get the current status of a crawl job. */
  getCrawl<T = unknown>(jobId: string): Promise<CrawlJobResponse<T>> {
    return this.crawlResource.get<T>(jobId);
  }

  /** Get crawled pages with signed download URLs. */
  crawlPages<T = unknown>(jobId: string, params?: CrawlPagesParams): Promise<CrawlPagesResponse<T>> {
    return this.crawlResource.pages<T>(jobId, params);
  }

  /** Cancel a queued or running crawl job. Pages already processed are preserved. */
  cancelCrawl(jobId: string): Promise<CrawlCancelResponse> {
    return this.crawlResource.cancel(jobId);
  }

  /** Re-extract data from an existing crawl with a new transform instruction (no re-crawling). */
  crawlExtract(jobId: string, transformInstruction: string): Promise<CrawlQueued> {
    return this.crawlResource.extract(jobId, transformInstruction);
  }

  /** List past crawl jobs for the authenticated user, newest first. */
  crawlHistory(params?: CrawlHistoryParams): Promise<CrawlHistoryResponse> {
    return this.crawlResource.history(params);
  }

  /** Get total crawl job count for the authenticated user. */
  crawlStats(): Promise<CrawlStats> {
    return this.crawlResource.stats();
  }

  /** What a finished crawl skipped and why (filter with `reason`, page with `limit`/`offset`). */
  crawlReport(jobId: string, params?: CrawlReportParams): Promise<CrawlReportResponse> {
    return this.crawlResource.report(jobId, params);
  }

  /** List the page URLs of a site without scraping them, optionally ranked by a search. 1 credit per call. */
  map(params: MapParams): Promise<MapResult> {
    return this.crawlResource.map(params);
  }

  /** Get a flat details snapshot for a crawl job (config + counters), distinct from `getCrawl()`'s job-queue poll shape. */
  crawlJobDetails(jobId: string): Promise<CrawlJobDetails> {
    return this.crawlResource.jobDetails(jobId);
  }

  /**
   * Re-run the AI transformation for one already-crawled page, using the crawl job's own
   * transform instruction. Useful when a page's extraction failed or needs a retry.
   */
  retryCrawlPage<T = unknown>(jobId: string, pageId: string): Promise<CrawlRetryPageResponse<T>> {
    return this.crawlResource.retryPage<T>(jobId, pageId);
  }

  /**
   * Download a completed crawl's successful pages as a zip.
   * `include` controls which file types land in the archive (default: all three).
   */
  downloadCrawlResults(jobId: string, include?: ("html" | "markdown" | "data")[]): Promise<Blob> {
    return this.crawlResource.download(jobId, include);
  }

  /**
   * Watch a crawl job, receiving each page as it is crawled:
   *
   * ```ts
   * const watcher = client.watchCrawl(jobId);
   * watcher.on("page", (page) => console.log(page.url, page.data));
   * const final = await watcher.wait();
   * ```
   */
  watchCrawl<T = unknown>(jobId: string, options?: WatchOptions): CrawlWatcher<T> {
    return new CrawlWatcher<T>(this.crawlResource, jobId, options);
  }

  // ---- Search ----------------------------------------------------------

  /**
   * Run a search and wait for the result. A plain search usually resolves in
   * a few seconds -- often within this single call, no polling at all --
   * while one with `scrapeOptions` set takes as long as the slowest page it
   * scrapes and always polls.
   */
  async search(params: SearchParams, options?: PollOptions): Promise<SearchResult> {
    const job = await this.searchResource.run(params, options);
    return job.result;
  }

  /** Submit a search job and return immediately without waiting. */
  startSearch(params: SearchParams): Promise<SearchJobQueued> {
    return this.searchResource.submit(params);
  }

  /** Get the current status of a search job. */
  getSearch(jobId: string): Promise<SearchJobResponse> {
    return this.searchResource.get(jobId);
  }

  // ---- Logs ----------------------------------------------------------

  /** List scrape logs for the authenticated user with optional filters. */
  scrapeLogs(params?: ScrapeLogsParams): Promise<ScrapeLogsResponse> {
    return this.logsResource.list(params);
  }

  /** Get a single scrape log by its UUID, including the full AI extraction result. */
  getScrapeLog(uuid: string): Promise<ScrapeLogDetail> {
    return this.logsResource.get(uuid);
  }

  // ---- Usage ----------------------------------------------------------

  /** Get usage statistics for the given time range ("7d" | "30d" | "weekly"). */
  usage(range: UsageRange): Promise<UsageStatRow[]> {
    return this.usageResource.get(range);
  }

  /** Get your plan, remaining credits and proxy bandwidth. */
  account(): Promise<AccountSummary> {
    return this.usageResource.account();
  }
}
