import type { SchemaInput } from "../lib/schema.js";

export type OutputFormat = "json" | "markdown";
export type ProxyCountry =
  | "us" | "gb" | "de" | "fr" | "jp" | "au" | "ca" | "br" | "in"
  | "nl" | "sg" | "es" | "it" | "mx" | "za" | "ng" | "ar" | "be"
  | "ch" | "cl" | "cn" | "co" | "cz" | "dk" | "eg" | "fi" | "gr"
  | "hk" | "hu" | "id" | "ie" | "il" | "kr" | "my" | "no" | "nz"
  | "pe" | "ph" | "pl" | "pt" | "ro" | "sa" | "se" | "th" | "tr"
  | "tw" | "ua" | "vn" | "eu" | "global"
  | (string & {}); // allow unlisted codes without losing autocomplete

/**
 * Every browser action type. The API also accepts these in any case ("Click", "waitfor") and a few aliases
 * ("fill" for type, "waitForSelector" for waitFor), which you can send through {@link GenericBrowserAction}.
 */
export type BrowserActionType =
  | "click"
  | "type"
  | "check"
  | "uncheck"
  | "hover"
  | "select"
  | "press"
  | "wait"
  | "waitFor"
  | "scroll"
  | "scrollUntilEnd"
  | "evaluate"
  | "screenshot"
  | "forEach";

/** Fields every action (except forEach) accepts. */
interface ActionOptions {
  /**
   * `true`: if this step fails, it is skipped and reported as `"skipped"` in `actionResults`, and the rest run.
   * By default a failed step fails the whole job (failed jobs are free) with
   * `Action N (type "target") failed: <reason>`.
   */
  optional?: boolean;
  /** How long to look for the element, in milliseconds (100 to 30000, default 10000). */
  timeout?: number;
}

/**
 * The element to act on: a CSS selector (`"#login"`), an XPath (`"//button[1]"`) or a plain-English description
 * (`"the Sign in button"`). A description is found on the page once and then used like a selector.
 */
type Target = string;

/** Click an element. */
export interface ClickAction extends ActionOptions {
  type: "click";
  selector: Target;
}

/** Fill a text field. Without `selector`, the first visible text field on the page is used. */
export interface TypeAction extends ActionOptions {
  type: "type";
  selector?: Target;
  /** The text to type. */
  value?: string;
  /** Same as `value`. */
  text?: string;
}

/** Tick a checkbox. */
export interface CheckAction extends ActionOptions {
  type: "check";
  selector: Target;
}

/** Untick a checkbox. */
export interface UncheckAction extends ActionOptions {
  type: "uncheck";
  selector: Target;
}

/** Move the mouse over an element, for example to open a menu. */
export interface HoverAction extends ActionOptions {
  type: "hover";
  selector: Target;
}

/** Choose an option in a dropdown (a `<select>` or a custom one), by its label or value. */
export interface SelectAction extends ActionOptions {
  type: "select";
  selector: Target;
  /** The option to choose, or several for a multi-select (20 at most). */
  value?: string | string[];
  /** Same as `value`. */
  option?: string | string[];
}

/** Press a key, on an element or on the page. */
export interface PressAction extends ActionOptions {
  type: "press";
  /** A key name such as `"Enter"`, `"Tab"`, `"Escape"`, `"ArrowDown"` or `"Control+A"`. */
  key: string;
  /** The element to press it on. Without one, the key goes to the page. */
  selector?: Target;
}

/** Pause for a fixed time. */
export interface WaitAction {
  type: "wait";
  /** Milliseconds to wait (1 to 30000). */
  duration: number;
  optional?: boolean;
}

/** Wait until an element reaches a state. */
export interface WaitForAction extends ActionOptions {
  type: "waitFor";
  selector: Target;
  /** Default `"visible"`. */
  state?: "visible" | "attached" | "hidden" | "detached";
}

/**
 * Scroll the page. Set `to` (a percentage of the page height such as `80` or `"80%"`, `"top"`, `"bottom"`, or an
 * element to scroll into view) or `pixels` (scroll by that amount; negative scrolls up).
 */
export interface ScrollAction extends ActionOptions {
  type: "scroll";
  to?: number | string;
  pixels?: number;
}

/** Keep scrolling (or clicking a "load more" button) until the page stops growing. */
export interface ScrollUntilEndAction extends ActionOptions {
  type: "scrollUntilEnd";
  /** Most rounds to run (1 to 30, default 10). */
  maxScrolls?: number;
  /** Milliseconds to wait after each round (200 to 5000, default 1500). */
  pause?: number;
  /** A "load more" button to click each round instead of scrolling, while it is visible. */
  clickSelector?: Target;
}

/**
 * Run JavaScript in the page. An expression (`"document.title"`) is returned as is; statements need `return`.
 * The value comes back as `result` in this step's entry of `actionResults` (cut at 10,000 characters).
 */
export interface EvaluateAction extends ActionOptions {
  type: "evaluate";
  /** The code to run (10,000 characters at most). */
  script: string;
}

/** Take a screenshot at this point. Its link comes back as `screenshotUrl` in `actionResults`. */
export interface ScreenshotAction extends ActionOptions {
  type: "screenshot";
  /** Capture the whole scrollable page instead of the viewport. */
  fullPage?: boolean;
}

/** The actions a forEach can run on each item: any action except another forEach, 10 at most. */
export type ForEachItemAction = Exclude<BrowserAction, ForEachAction>;

/**
 * Go through a set of elements and capture each one. It must be the only forEach and the last action, since it
 * collects the results.
 */
export interface ForEachAction {
  type: "forEach";
  /** Which elements to go through, in plain English, e.g. `"each product card"`. */
  observe: string;
  /**
   * `"click"` (default) clicks each item and captures what appears (a modal or expanded section), `"inline"` reads
   * each item where it is, `"navigate"` opens each item's link and captures that page.
   */
  mode?: "click" | "inline" | "navigate";
  /** What to capture for each item: a CSS selector, XPath or description. Without it, the whole page or item. */
  captureSelector?: string;
  /** Most items to process across all pages (1 to 50, default 50). */
  maxItems?: number;
  /** Milliseconds to wait after clicking or opening an item before capturing it (0 to 10000, default 2500). */
  waitAfterClick?: number;
  /** An extraction prompt run on each item on its own, before the top-level `prompt` sees them all. */
  itemPrompt?: string;
  /** Actions to run on each item after it is clicked or opened (10 at most, no forEach). */
  actions?: ForEachItemAction[];
  /** Move to the next results page after the items on the current one. */
  pagination?: {
    /** The next-page button or link: a CSS selector, XPath or description. */
    nextSelector: string;
    /** Pages to go through in total, counting the first (1 to 10, default 5). */
    maxPages?: number;
  };
}

/**
 * One browser action. Actions run in order before the page is captured. Use {@link GenericBrowserAction} for
 * actions built at runtime.
 */
export type BrowserAction =
  | ClickAction
  | TypeAction
  | CheckAction
  | UncheckAction
  | HoverAction
  | SelectAction
  | PressAction
  | WaitAction
  | WaitForAction
  | ScrollAction
  | ScrollUntilEndAction
  | EvaluateAction
  | ScreenshotAction
  | ForEachAction;

/**
 * Any action as a plain object, with every field optional: for actions built at runtime (from config or user input),
 * for type names in another case or an alias, and for code written against SDK 0.8 and earlier. The API checks it
 * and answers 422 naming the action and the problem.
 */
export interface GenericBrowserAction {
  type: BrowserActionType | (string & {});
  selector?: string;
  /** Text to type, option to select, or key to press. Older code also used it for the target or the wait time. */
  value?: string | number | string[];
  text?: string;
  key?: string;
  option?: string | string[];
  timeout?: number;
  optional?: boolean;
  duration?: number;
  state?: "visible" | "attached" | "hidden" | "detached";
  to?: number | string;
  pixels?: number;
  maxScrolls?: number;
  pause?: number;
  clickSelector?: string;
  script?: string;
  fullPage?: boolean;
  observe?: string;
  mode?: "click" | "inline" | "navigate";
  captureSelector?: string;
  maxItems?: number;
  waitAfterClick?: number;
  itemPrompt?: string;
  actions?: Array<BrowserAction | GenericBrowserAction>;
  pagination?: { nextSelector: string; maxPages?: number };
}

/** How one action went. `index` is its position in `actions`, from 1. */
export interface ActionResult {
  index: number;
  /** The action's type, in its canonical name (`"waitFor"` for `"waitForSelector"`). */
  type: Exclude<BrowserActionType, "forEach"> | (string & {});
  /** `"skipped"` is an optional step that failed; `"failed"` is a step that failed the job. */
  status: "ok" | "skipped" | "failed";
  durationMs: number;
  /** Why the step failed or was skipped. */
  error?: string;
  /** evaluate: what the script returned. scrollUntilEnd: `{ scrolls, stoppedBecause: "end" | "maxScrolls" }`. */
  result?: unknown;
  /** screenshot: a link to the image. */
  screenshotUrl?: string;
}

export interface ScrapeUrl {
  url: string;
  /**
   * Browser actions to run in order before the page is captured (50 at most, 60 seconds of waiting in total).
   * Can't be combined with `instruction`.
   */
  actions?: Array<BrowserAction | GenericBrowserAction>;
  /**
   * One plain-English task for the browser to carry out before the page is captured, such as
   * `"search for wireless headphones and open the first result"` (2000 characters at most). Always runs in a
   * browser. Can't be combined with `actions`.
   */
  instruction?: string;
}

export interface ScrapeParams<S extends SchemaInput = SchemaInput> {
  urls: ScrapeUrl[];
  /** Optional when `schema` is provided: a schema-only extraction needs no natural-language prompt. */
  prompt?: string;
  output?: OutputFormat;
  /** JSON Schema object, or a Zod v4 schema, converted automatically. */
  schema?: S;
  useProxy?: boolean;
  proxyCountry?: ProxyCountry;
  /** "fast" skips the browser for a plain HTTP fetch; "default" (the default) renders with a real browser. */
  scrapeMode?: "fast" | "default";
  extractContentOnly?: boolean;
  screenshot?: boolean;
  /** Capture the full scrollable page. Implies a screenshot, so `screenshot: true` is not needed as well. */
  fullPageScreenshot?: boolean;
  cookies?: string;
}

// --- Job status shapes ---

export type JobStatus = "waiting" | "active" | "completed" | "failed";

export interface ScrapeJobQueued {
  status: "queued";
  jobId: string;
  /** Non-fatal issues with the provided `schema` (e.g. unsupported keywords), present only when there were any. */
  schema_warnings?: string[];
}

export interface ScrapeUrlResult {
  url: string;
  title?: string;
  markdownContent?: string;
  success: boolean;
  screenshotUrl?: string | null;
  /** Heuristic warning, not a hard failure: the cleaned content came back under ~200 characters, more likely a bot check, cookie wall, or dead redirect than the real page. */
  lowContent?: boolean;
  /** The page's fields as an object, present when the URL was handled by one of Spidra's site scrapers (Amazon, LinkedIn, Google Maps and others). Markdown output does not include this data; read it here. */
  structuredData?: Record<string, unknown>;
  /** The cleaned link a site scraper actually used (tracking parameters removed, short link resolved), present only when it differs from `url`. `url` is always the URL you sent. */
  canonicalUrl?: string;
  /** Things you asked for that were not done for this URL, e.g. `"deliveryZip was not applied to this page."`, a skipped optional action or a forEach that fell back to the whole page. */
  warnings?: string[];
  /** One entry per browser action, in order, present when the URL had actions. */
  actionResults?: ActionResult[];
  /** forEach: how many items were captured. */
  forEachItems?: number;
}

export interface ScrapeResult<T = unknown> {
  content: T;
  data: ScrapeUrlResult[];
  screenshots: string[];
  ai_extraction_failed: boolean;
  /** True when AI ran successfully but returned structurally empty data (e.g. `{"rooms":[]}`), only set when a prompt or schema was used. */
  extraction_empty?: boolean;
  /** Everything worth knowing that didn't fail the job, across all URLs: skipped optional actions, a forEach that fell back or stopped early, credits that ran short. With several URLs, each line starts with its URL. */
  warnings?: string[];
  stats: {
    durationMs: number;
    captchaSolvedCount: number;
    inputTokens: number;
    outputTokens: number;
    totalTokens: number;
  };
}

export interface ScrapeJobPending {
  status: "waiting" | "active";
  progress?: { message: string; progress: number };
  schema_warnings?: string[];
}

export interface ScrapeJobCompleted<T = unknown> {
  status: "completed";
  progress?: { message: string; progress: number };
  result: ScrapeResult<T>;
  error: null;
  schema_warnings?: string[];
}

export interface ScrapeJobFailed {
  status: "failed";
  error: string;
  schema_warnings?: string[];
}

export type ScrapeJobResponse<T = unknown> =
  | ScrapeJobPending
  | ScrapeJobCompleted<T>
  | ScrapeJobFailed;
