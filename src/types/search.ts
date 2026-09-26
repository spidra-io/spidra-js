/**
 * `research` (arXiv, PubMed, bioRxiv, medRxiv) and `developer` (GitHub
 * issues/PRs) are two dedicated, sanctioned APIs. `includeDomains`/
 * `excludeDomains`/`filetype` don't apply to either.
 */
export type SearchSource = "web" | "news" | "images" | "videos" | "research" | "developer";

/**
 * Restricts results to a recency window. Support and granularity can vary
 * by source and query. A window that can't be honored is simply ignored
 * rather than erroring, so you may occasionally see slightly wider results
 * than requested.
 */
export type SearchTimeRange = "hour" | "day" | "week" | "month" | "year";

export interface SearchScrapeOptions {
  formats: ("markdown" | "screenshot")[];
  /** Caps how many of the ranked web results actually get scraped, top-down. Omit to scrape every web result returned. */
  maxResults?: number;
}

export interface SearchParams {
  query: string;
  /** Which result sources to request. Default: `["web"]` */
  sources?: SearchSource[];
  /** Results per source, 1–20. Default: 10 */
  limit?: number;
  /**
   * 1-indexed, default 1. Prefer `pageTokens` once you have one from a
   * prior response, it's a more reliable way to continue to a specific
   * page than passing `page` alone.
   */
  page?: number;
  /**
   * One opaque token per source, taken from an earlier response's
   * `nextPageTokens`, for reliably continuing to that source's next page.
   * Falls back to a normal fresh search for that source if the token can't
   * be used (e.g. it expired). Never a hard error.
   */
  pageTokens?: Partial<Record<SearchSource, string>>;
  /** Restricts results to a recency window. See `SearchTimeRange`. */
  timeRange?: SearchTimeRange;
  /** ISO country code (e.g. "us"), or "global" / "eu" / "asia" */
  country?: string;
  /** Mutually exclusive with `excludeDomains`. Doesn't apply to `research`/`developer` sources. */
  includeDomains?: string[];
  /** Mutually exclusive with `includeDomains`. Doesn't apply to `research`/`developer` sources. */
  excludeDomains?: string[];
  /** Restricts results to PDF files. Doesn't apply to `research`/`developer` sources. */
  filetype?: "pdf";
  /** Opt-in search + scrape enrichment, modeled on Firecrawl's `scrapeOptions`. */
  scrapeOptions?: SearchScrapeOptions;
  /**
   * Ask the API to hold the request open and respond with the real result
   * directly, instead of always requiring a poll. `client.search()` already
   * sets this internally, so you won't normally set it yourself. It's
   * exposed mainly for `startSearch()`/raw HTTP use. Ignored when
   * `scrapeOptions` is set (that case can take much longer than any
   * request can safely stay open), and falls back to the normal queued
   * response if the search doesn't finish within the wait window
   * (~20 seconds). Never a hard error either way.
   */
  wait?: boolean;
}

export interface SearchResultItem {
  title: string;
  url: string;
  description?: string;
  position: number;
  /** images source only */
  imageUrl?: string;
  /** images/videos */
  thumbnailUrl?: string;
  /** images source only */
  imageWidth?: number;
  /** images source only */
  imageHeight?: number;
  /** news/videos source. `research` source: publication date. */
  date?: string;
  /** news source: publisher name. `research` source: journal/repository name (e.g. "arXiv", "bioRxiv", or a real journal title). */
  source?: string;
  /** videos source only */
  duration?: string;
  /** `research` source: comma-separated author names. `developer` source: the GitHub issue/PR's reporter login. */
  authors?: string;
  /** `research` source only, when the record has one */
  doi?: string;
  /** web results only, present when `scrapeOptions` was requested and enrichment succeeded before the job's budget ran out */
  markdown?: string;
  /** web results only, present when `scrapeOptions.formats` included "screenshot" */
  screenshotUrl?: string;
}

export interface SearchExtras {
  relatedSearches?: string[];
  topStories?: { title: string; url: string; source?: string; date?: string }[];
  answerBox?: { type: "currency" | "unit_conversion"; value: string };
  knowledgeBox?: { title: string; category?: string; description?: string };
}

export interface SearchResponseData {
  web?: SearchResultItem[];
  news?: SearchResultItem[];
  images?: SearchResultItem[];
  videos?: SearchResultItem[];
  /** arXiv + Europe PMC (PubMed/bioRxiv/medRxiv) results, interleaved. */
  research?: SearchResultItem[];
  /** GitHub issues/PRs. */
  developer?: SearchResultItem[];
  extras?: SearchExtras;
  /**
   * One opaque, per-source token for reliably fetching the next page of
   * this exact result set. Pass it back as `pageTokens` on a following
   * request instead of just bumping `page`. Absent for a source that
   * didn't succeed, or with no more pages left.
   */
  nextPageTokens?: Partial<Record<SearchSource, string>>;
}

export interface SearchStats {
  durationMs: number;
}

export interface SearchResult {
  success: boolean;
  data: SearchResponseData;
  stats: SearchStats;
  /**
   * The search log this result is recorded under. Nothing needs to be done
   * with this for pagination to work -- continuing with `pageTokens` keeps
   * a later page linked back to this same search automatically. Exposed
   * mainly as a direct reference to the log entry itself.
   */
  logUuid?: string;
}

// --- Job status shapes ---

export interface SearchJobQueued {
  status: "queued";
  jobId: string;
}

export interface SearchJobPending {
  status: "waiting" | "active";
  progress?: { message: string; progress: number };
}

export interface SearchJobCompleted {
  status: "completed";
  jobId?: string;
  progress?: { message: string; progress: number };
  result: SearchResult;
  error: null;
}

export interface SearchJobFailed {
  status: "failed";
  jobId?: string;
  error: string;
}

export type SearchJobResponse = SearchJobPending | SearchJobCompleted | SearchJobFailed;
