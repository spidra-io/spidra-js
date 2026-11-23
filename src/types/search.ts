/**
 * `research` (arXiv, PubMed, bioRxiv, medRxiv) and `developer` (GitHub
 * issues, pull requests, repositories and users) are two dedicated,
 * sanctioned APIs. `includeDomains`/`excludeDomains`/`filetype` don't apply
 * to either.
 */
export type SearchSource = "web" | "news" | "images" | "videos" | "research" | "developer";

/**
 * Favors results from a recency window (web, news, images and videos). It
 * shapes results rather than strictly filtering them. When you ask for
 * several sources and one can't apply it, that source runs without it and
 * the result's `warnings` says so; when none can, the request fails with 422.
 */
export type SearchTimeRange = "hour" | "day" | "week" | "month" | "year";

/** File types `filetype` accepts. Every web result is checked against it. */
export type SearchFiletype =
  | "pdf"
  | "doc"
  | "docx"
  | "xls"
  | "xlsx"
  | "ppt"
  | "pptx"
  | "txt"
  | "csv"
  | "rtf"
  | "odt"
  | "ods"
  | "odp"
  | "epub";

/**
 * Languages `language` accepts: ISO 639-1 codes, plus `zh-CN` and `zh-TW`.
 * Typed as a union for autocomplete; the API rejects any other value.
 */
export type SearchLanguage =
  | "ar" | "bg" | "ca" | "cs" | "da" | "de" | "el" | "en" | "es" | "et" | "fi" | "fr" | "he"
  | "hr" | "hu" | "id" | "is" | "it" | "ja" | "ko" | "lt" | "lv" | "nl" | "no" | "pl" | "pt"
  | "ro" | "ru" | "sk" | "sl" | "sr" | "sv" | "th" | "tr" | "uk" | "vi" | "zh-CN" | "zh-TW";

/** Which GitHub results the `developer` source returns. `"issues"` covers issues and pull requests. */
export type SearchDeveloperType = "issues" | "repositories" | "users";

export interface SearchScrapeOptions {
  /** Markdown-only -- want a screenshot of a specific result? Scrape that URL directly with `client.scrape()` instead. */
  formats: ("markdown")[];
  /** Caps how many of the ranked web results actually get scraped, top-down. Omit to scrape every web result returned. */
  maxResults?: number;
}

export interface SearchParams {
  query: string;
  /** Which result sources to request. Default: `["web"]` */
  sources?: SearchSource[];
  /** The most results per source, 1 to 20. A source with fewer matches returns fewer. Default: 10 */
  limit?: number;
  /**
   * 1-indexed, 1 to 5, default 1. Prefer `pageTokens` once you have one
   * from a prior response, it's a more reliable way to continue to a
   * specific page than passing `page` alone.
   */
  page?: number;
  /**
   * One opaque token per source, taken from an earlier response's
   * `nextPageTokens`, for reliably continuing to that source's next page.
   * Send it with the same query and options. Falls back to a normal fresh
   * search for that source if the token can't be used (e.g. it expired).
   * Never a hard error.
   */
  pageTokens?: Partial<Record<SearchSource, string>>;
  /** Favors results from a recency window. See `SearchTimeRange`. Not with `startDate`/`endDate`. */
  timeRange?: SearchTimeRange;
  /** ISO country code (e.g. "us"), or "global" / "eu" / "asia" */
  country?: string;
  /** Mutually exclusive with `excludeDomains`. Doesn't apply to `research`/`developer` sources. */
  includeDomains?: string[];
  /** Mutually exclusive with `includeDomains`. Doesn't apply to `research`/`developer` sources. */
  excludeDomains?: string[];
  /** Only web results that are files of this type. Every result is checked. Web only. */
  filetype?: SearchFiletype;
  /** `"strict"` filters adult results out. `"off"` (the default) doesn't filter. Web, news, images and videos. */
  safeSearch?: "off" | "strict";
  /** Prefer pages in this language, such as `"de"`, whatever the `country`. Web, news and videos. */
  language?: SearchLanguage;
  /**
   * Only results on or after this date, as `YYYY-MM-DD`. Either end of the
   * range can be left out. Can't be in the future. Web, news and videos.
   * Not with `timeRange`.
   */
  startDate?: string;
  /** Only results on or before this date, as `YYYY-MM-DD`. See `startDate`. */
  endDate?: string;
  /** `"date"` returns news newest first. News only. Default: `"relevance"` */
  sort?: "relevance" | "date";
  /**
   * For the `developer` source: which GitHub results to return, in this
   * order. Each type returns up to `limit` results. Default: `["issues"]`
   */
  developerTypes?: SearchDeveloperType[];
  /** Opt-in search + scrape enrichment, modeled on Firecrawl's `scrapeOptions`. */
  scrapeOptions?: SearchScrapeOptions;
  /**
   * Ask the API to hold the request open and respond with the real result
   * directly, instead of always requiring a poll. `client.search()` already
   * sets this internally, so you won't normally set it yourself. It's
   * exposed mainly for `startSearch()`/raw HTTP use. Works with
   * `scrapeOptions` too, and falls back to the normal queued response if
   * the search doesn't finish within the wait window (~20 seconds). Never
   * a hard error either way.
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
  /** web results only, present with `markdown` when the page came from one of Spidra's site scrapers */
  structuredData?: Record<string, unknown>;
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
   * request instead of just bumping `page`. A source only has a token when
   * it really has a next page: no token means that source has no more
   * results (or didn't succeed), so stop paging it.
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
   * What this search was charged: 1 credit per 10 results per source
   * (rounded up, empty sources free), plus 1 per page read with
   * `scrapeOptions`.
   */
  creditsUsed: number;
  /**
   * One plain sentence per option a requested source couldn't apply (that
   * source ran without it). Absent when there are none.
   */
  warnings?: string[];
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
