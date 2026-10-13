/** How pages are read. `auto` uses each page's own text and AI only for scans; `fast` never uses AI; `ocr` uses AI on every page. */
export type ParseMode = "auto" | "fast" | "ocr";

/** A document to parse: a file's bytes, a link, or a fileId from an earlier upload. */
export type ParseInput =
  | { file: Blob | Uint8Array | ArrayBuffer; fileName: string }
  | { url: string }
  | { fileId: string };

export interface ParseOptions {
  mode?: ParseMode;
  /** PDF pages to parse, like "1-5, 9" or "10-". Default: every page. */
  pages?: string;
  /** Parse at most this many pages. */
  maxPages?: number;
  /** Put `<!-- page N -->` between pages in `markdown`. */
  pageMarkers?: boolean;
  /** Return per-page Markdown in `pages`. */
  includePages?: boolean;
  /** Fields to extract, in plain words; the result is in `json`. */
  prompt?: string;
  /** JSON Schema for the extraction; the result is in `json`. */
  schema?: Record<string, unknown>;
}

export interface ParsedPage {
  pageNumber: number;
  markdown: string;
  /** "text" when the page's own text was used, "ocr" when AI read the page. */
  method: "text" | "ocr";
  error?: string;
}

export interface ParseJob<T = unknown> {
  jobId: string;
  status: "queued" | "running" | "completed" | "failed";
  fileName: string | null;
  sourceUrl: string | null;
  /** Parse the same file again with other options, for 24 hours, without uploading it again. */
  fileId: string | null;
  format: string | null;
  totalPages: number | null;
  pagesParsed: number | null;
  creditsUsed: number;
  error?: string;
  progress?: { message?: string; done?: number; total?: number };
  markdown?: string;
  pages?: ParsedPage[];
  json?: T;
  warnings?: string[];
  metadata?: { fileName: string | null; sourceUrl: string | null; format: string; totalPages: number; pagesParsed: number; ocrPages: number };
  durationMs?: number | null;
  message?: string;
}

export interface ParseEstimate {
  status: "estimate";
  fileId: string;
  fileName: string;
  format: string;
  totalPages: number;
  pagesToParse: number;
  credits: number;
  creditsNote?: string;
}

export interface ParseBatchStarted {
  batchId: string;
  documents: Array<{ jobId?: string; status: string; fileName: string | null; fileId?: string; totalPages?: number; credits?: number; error?: string }>;
}

export interface ParseBatch<T = unknown> {
  batchId: string;
  status: "running" | "completed";
  counts: Record<"queued" | "running" | "completed" | "failed", number>;
  creditsUsed: number;
  documents: ParseJob<T>[];
}

export interface PreparedUpload {
  fileId: string;
  uploadUrl: string;
  method: "PUT";
  expiresIn: number;
}
