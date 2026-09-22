export type SearchSource = "web" | "news" | "images" | "videos";

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
  /** ISO country code (e.g. "us"), or "global" / "eu" / "asia" */
  country?: string;
  /** Mutually exclusive with `excludeDomains` */
  includeDomains?: string[];
  /** Mutually exclusive with `includeDomains` */
  excludeDomains?: string[];
  /** Opt-in search + scrape enrichment, modeled on Firecrawl's `scrapeOptions`. */
  scrapeOptions?: SearchScrapeOptions;
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
  /** news/videos source */
  date?: string;
  /** news source only — publisher name */
  source?: string;
  /** videos source only */
  duration?: string;
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
  extras?: SearchExtras;
}

export interface SearchStats {
  durationMs: number;
}

export interface SearchResult {
  success: boolean;
  data: SearchResponseData;
  stats: SearchStats;
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
  progress?: { message: string; progress: number };
  result: SearchResult;
  error: null;
}

export interface SearchJobFailed {
  status: "failed";
  error: string;
}

export type SearchJobResponse = SearchJobPending | SearchJobCompleted | SearchJobFailed;
