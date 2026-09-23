# Spidra Node SDK

The official Node.js SDK for [Spidra](https://spidra.io) that allows you to scrape pages, run browser actions, batch-process URLs, crawl entire sites, and search the web. All results come back as structured data ready to feed into your LLM pipelines or store directly.

## Installation

To install the Spidra Node SDK, you can use npm:

```bash
npm install spidra
```

Get your API key at [app.spidra.io](https://app.spidra.io) under **Settings** > **API Keys**.

## Quick start

```typescript
import { SpidraClient } from "spidra";

const spidra = new SpidraClient({ apiKey: "spd_YOUR_API_KEY" });

const result = await spidra.scrape({
  urls: [{ url: "https://news.ycombinator.com" }],
  prompt: "List the top 5 stories with title, points, and comment count",
  output: "json",
});

console.log(result.content);
```

## Table of contents

- [Spidra Node SDK](#spidra-node-sdk)
  - [Installation](#installation)
  - [Quick start](#quick-start)
  - [Table of contents](#table-of-contents)
  - [Searching](#searching)
  - [Scraping](#scraping)
    - [Basic scrape](#basic-scrape)
    - [Structured output with JSON schema](#structured-output-with-json-schema)
    - [Structured output with Zod](#structured-output-with-zod)
    - [Geo-targeted scraping](#geo-targeted-scraping)
    - [Authenticated pages](#authenticated-pages)
    - [Browser actions](#browser-actions)
    - [forEach: process every element on a page](#foreach-process-every-element-on-a-page)
      - [inline mode](#inline-mode)
      - [navigate mode](#navigate-mode)
      - [click mode](#click-mode)
      - [Pagination](#pagination)
      - [Per-element actions](#per-element-actions)
      - [itemPrompt vs top-level prompt](#itemprompt-vs-top-level-prompt)
    - [Manual job control](#manual-job-control)
    - [Poll options](#poll-options)
  - [Batch scraping](#batch-scraping)
  - [Crawling](#crawling)
  - [Watching jobs (streaming results)](#watching-jobs-streaming-results)
  - [Logs](#logs)
  - [Usage statistics](#usage-statistics)
  - [Retries and reliability](#retries-and-reliability)
  - [Error handling](#error-handling)
  - [Verifying webhooks](#verifying-webhooks)
  - [AI agent integration](#ai-agent-integration)

## Searching

Search runs a real query and returns structured results — titles, links, descriptions, thumbnails — the same data you'd get scraping a search engine yourself, minus the scraping. Unlike scrape/batch/crawl, a plain search usually resolves in a few seconds.

```typescript
const result = await spidra.search({
  query: "best espresso machine 2026",
  sources: ["web", "news"],
});

for (const hit of result.data.web ?? []) {
  console.log(hit.title, hit.url);
}
```

By default only `web` results come back. Request more with `sources`:

| Source | Description |
|--------|-------------|
| `web` | Standard web results (default) |
| `news` | News articles |
| `images` | Image results |
| `videos` | Video results |

Each source is independent — if one comes back empty or is temporarily unavailable, the others are unaffected.

**All search parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `query` | `string` | **Required.** What to search for. |
| `sources` | `("web" \| "news" \| "images" \| "videos")[]` | Which result types to request. Defaults to `["web"]`. |
| `limit` | `number` | Results per source, 1–20. Defaults to 10. |
| `country` | `string` | Two-letter country code, or `"global"` / `"eu"` / `"asia"`, for localized results. |
| `includeDomains` | `string[]` | Only return `web` results from these domains. Mutually exclusive with `excludeDomains`. |
| `excludeDomains` | `string[]` | Keep `web` results from these domains out. Mutually exclusive with `includeDomains`. |
| `scrapeOptions` | `{ formats, maxResults? }` | Opt-in — also scrape each web result's page content. See below. |

### Domain filtering

Restrict `web` results to specific domains, or keep specific domains out. Pass one or the other, never both.

```typescript
const result = await spidra.search({
  query: "espresso machine reviews",
  includeDomains: ["reddit.com"],
});
```

### Scrape content from results

Add `scrapeOptions` to also fetch each web result's actual page content in the same call — no second request, no separate job to poll.

```typescript
const result = await spidra.search({
  query: "posthog before_send config",
  scrapeOptions: { formats: ["markdown"], maxResults: 5 },
});

result.data.web?.[0].markdown; // the scraped page's content, right there on the result
```

This makes the search take as long as its slowest scraped page, not the usual few seconds — real scraping isn't instant, and Spidra would rather you wait once on one job than build your own polling loop around N separate scrape jobs. `maxResults` caps how many of the top-ranked web results get scraped; omit it to scrape all of them, up to a cap of 10. A result that fails to scrape or falls outside the time budget is simply left without `markdown`, not treated as an error.

Need AI extraction, a schema, or a screenshot instead of plain markdown? Scrape that specific URL directly with [`spidra.scrape()`](#scraping).

### Manual job control

```typescript
const { jobId } = await spidra.startSearch({ query: "electric cars" });
const status = await spidra.getSearch(jobId);
```

## Scraping

All scrape jobs run asynchronously. `scrape()` submits a job and polls until it finishes. If you need more control, use `startScrape()` and `getScrape()` directly.

Up to 3 URLs can be passed per request and they are processed in parallel.

### Basic scrape

```typescript
const result = await spidra.scrape({
  urls: [{ url: "https://example.com/pricing" }],
  prompt: "Extract all pricing plans with name, price, and included features",
  output: "json",
});

console.log(result.content);
// { plans: [{ name: "Starter", price: "$9/mo", features: [...] }, ...] }
```

### Structured output with JSON schema

When you need a guaranteed shape, pass a `schema`. The API will enforce the structure and return `null` for any missing fields rather than hallucinating values.

> Define every field you want extracted — an untyped `object` with no `properties` gives the AI nothing to fill in, so those members come back empty.

```typescript
const result = await spidra.scrape({
  urls: [{ url: "https://jobs.example.com/senior-engineer" }],
  prompt: "Extract the job listing details",
  output: "json",
  schema: {
    type: "object",
    required: ["title", "company", "remote"],
    properties: {
      title:      { type: "string" },
      company:    { type: "string" },
      remote:     { type: ["boolean", "null"] },
      salary_min: { type: ["number", "null"] },
      salary_max: { type: ["number", "null"] },
      skills:     { type: "array", items: { type: "string" } },
    },
  },
});
```

> If your schema uses a keyword the API doesn't support (e.g. `anyOf`, `$ref`), the response includes `schema_warnings` listing what was ignored — the rest of the schema still applies.

### Structured output with Zod

You can pass a [Zod](https://zod.dev) (v4) schema directly instead of hand-writing JSON Schema — the SDK converts it automatically, and `result.content` is fully typed from your schema.

```typescript
import { z } from "zod";

const JobListing = z.object({
  title:   z.string(),
  company: z.string(),
  remote:  z.boolean().nullable(),
  skills:  z.array(z.string()),
});

const result = await spidra.scrape({
  urls:   [{ url: "https://jobs.example.com/senior-engineer" }],
  prompt: "Extract the job listing details",
  output: "json",
  schema: JobListing,
});

result.content.title; // typed as string — no casting needed
```

The same works for `batchScrape()` (types each item's `result`) and `crawl()` (types each page's `data`). Zod is an optional peer dependency — install it only if you use this (`npm install zod`). Passing `MySchema.shape` by mistake throws a helpful error.

### Geo-targeted scraping

Pass `useProxy: true` and a `proxyCountry` code to route the request through a specific country. Useful for geo-restricted content or localized pricing.

```typescript
const result = await spidra.scrape({
  urls: [{ url: "https://www.amazon.de/gp/bestsellers" }],
  prompt: "List the top 10 products with name and price",
  useProxy: true,
  proxyCountry: "de",
});
```

Supported country codes include: `us`, `gb`, `de`, `fr`, `jp`, `au`, `ca`, `br`, `in`, `nl`, `sg`, `es`, `it`, `mx`, and [40+ more](https://docs.spidra.io/features/stealth-mode#country-targeting). Use `"global"` or `"eu"` for regional routing.

### Authenticated pages

Pass cookies as a string to scrape pages that require a login session.

```typescript
const result = await spidra.scrape({
  urls: [{ url: "https://app.example.com/dashboard" }],
  prompt: "Extract the monthly revenue and active user count",
  cookies: "session=abc123; auth_token=xyz789",
});
```

### Browser actions

Actions let you interact with the page before the scrape runs. They execute in order, and the scrape happens after all actions complete.

```typescript
const result = await spidra.scrape({
  urls: [
    {
      url: "https://example.com/products",
      actions: [
        { type: "click", selector: "#accept-cookies" },
        { type: "wait",  duration: 1000 },
        { type: "scroll", to: "80%" },
      ],
    },
  ],
  prompt: "Extract all product names and prices",
});
```

**Available actions:**

| Action | Required fields | Description |
|--------|----------------|-------------|
| `click` | `selector` or `value` | Click a button, link, or any element |
| `type` | `selector`, `value` | Type text into an input or textarea |
| `check` | `selector` or `value` | Check a checkbox |
| `uncheck` | `selector` or `value` | Uncheck a checkbox |
| `wait` | `duration` (ms) | Pause execution for a set number of milliseconds |
| `scroll` | `to` (0-100%) | Scroll the page to a percentage of its height |
| `forEach` | `observe` | Loop over every matched element and process each one |

For `selector`, use a CSS selector or XPath. For `value`, use a plain English description and Spidra will locate the element using AI.

```typescript
// CSS selector
{ type: "click", selector: "button[data-testid='submit']" }

// Plain English
{ type: "click", value: "Accept all cookies button" }

// Type into a field
{ type: "type", selector: "input[name='q']", value: "wireless headphones" }

// Wait for content to load
{ type: "wait", duration: 2000 }

// Scroll to bottom
{ type: "scroll", to: "100%" }
```

### forEach: process every element on a page

`forEach` finds a set of elements on the page and processes each one individually. It is the right tool when you need to collect data from a list of items, paginate through multiple pages, or click into each item's detail page.

> You don't need `forEach` if the data fits on a single page and is short, a plain `prompt` is simpler and works just as well.

**Use forEach when:**
- The list spans multiple pages and you need `pagination`
- You need to click into each item's detail page (`navigate` mode)
- You have 20+ items and want per-item AI extraction to stay consistent (`itemPrompt`)

#### inline mode

Read each element's content directly without navigating. Best for product cards, search results, table rows.

```typescript
const result = await spidra.scrape({
  urls: [
    {
      url: "https://books.toscrape.com/catalogue/category/books/mystery_3/index.html",
      actions: [
        {
          type:            "forEach",
          observe:         "Find all book cards in the product grid",
          mode:            "inline",
          captureSelector: "article.product_pod",
          maxItems:        20,
          itemPrompt:      "Extract title, price, and star rating. Return as JSON: {title, price, star_rating}",
        },
      ],
    },
  ],
  prompt: "Return a clean JSON array of all books",
  output: "json",
});
```

#### navigate mode

Follow each element's link to its destination page and capture content there. Best for product listings where the full detail is only on the individual page.

```typescript
{
  type:            "forEach",
  observe:         "Find all book title links in the product grid",
  mode:            "navigate",
  captureSelector: "article.product_page",
  maxItems:        10,
  waitAfterClick:  800,
  itemPrompt:      "Extract title, price, star rating, and availability. Return as JSON.",
}
```

#### click mode

Click each element, capture the content that appears (a modal, drawer, or expanded section), then move on. Best for hotel room cards, FAQ accordions, or any UI where clicking reveals hidden content.

```typescript
{
  type:            "forEach",
  observe:         "Find all room type cards",
  mode:            "click",
  captureSelector: "[role='dialog']",
  maxItems:        8,
  waitAfterClick:  1200,
  itemPrompt:      "Extract room name, bed type, price per night, and amenities. Return as JSON.",
}
```

#### Pagination

After processing all elements on the current page, follow the next-page link and continue collecting.

```typescript
{
  type:     "forEach",
  observe:  "Find all book title links",
  mode:     "navigate",
  maxItems: 40,
  pagination: {
    nextSelector: "li.next > a",
    maxPages:     3,            // 3 additional pages beyond the first
  },
}
```

`maxItems` applies across all pages combined. The loop stops when you hit `maxItems`, run out of pages, or reach `maxPages`.

#### Per-element actions

Run additional browser actions on each item after navigating or clicking into it, before the content is captured. Useful for scrolling below the fold or expanding collapsed sections.

```typescript
{
  type:            "forEach",
  observe:         "Find all book title links",
  mode:            "navigate",
  captureSelector: "article.product_page",
  maxItems:        5,
  waitAfterClick:  1000,
  actions: [
    { type: "scroll", to: "50%" },
  ],
  itemPrompt: "Extract title, price, and full description. Return as JSON.",
}
```

#### itemPrompt vs top-level prompt

Both are optional and serve different purposes.

| | `itemPrompt` | `prompt` |
|--|--|--|
| When it runs | During scraping, once per item | After all items are collected |
| What it sees | One item's content | All items combined |
| Output location | Feeds into the top-level `prompt` | `result.content` |

Use `itemPrompt` to extract fields from each item individually. Use the top-level `prompt` to filter, sort, or reshape the full combined output. They can be used together.

### Manual job control

Use `startScrape()` and `getScrape()` when you want to manage polling yourself, or when you want to fire-and-forget and check back later.

```typescript
// Submit a job and get the jobId immediately
const { jobId } = await spidra.startScrape({
  urls: [{ url: "https://example.com" }],
  prompt: "Extract the main headline",
});

// Check status at any point
const status = await spidra.getScrape(jobId);

if (status.status === "completed") {
  console.log(status.result.content);
} else if (status.status === "failed") {
  console.error(status.error);
}
```

Job statuses: `queued`, `waiting`, `active`, `completed`, `failed`.

### Poll options

`scrape()`, `batchScrape()`, and `crawl()` accept an optional second argument to control polling behavior.

```typescript
const controller = new AbortController();

const result = await spidra.scrape(params, {
  pollInterval: 3000,        // ms between status checks (default: 3000)
  timeout:      600_000,     // max wait in ms before SpidraTimeoutError (default: null — wait until the job finishes)
  signal:       controller.signal, // stop waiting (the job itself keeps running)
  maxConsecutiveErrors: 3,   // transient errors (5xx/429/network) tolerated mid-poll (default: 3)
});
```

By default there is no timeout — these calls wait until the job reaches a terminal state, so long crawls just work. If you set a `timeout` and it fires, the SDK throws `SpidraTimeoutError`; the job keeps running server-side, so you can keep checking it with the matching `get*` method (`getScrape()`, `getBatchScrape()`, `getCrawl()`) or cancel it. Transient errors during polling (a 502 blip, a dropped connection) don't kill the wait — polling continues unless several happen in a row.

## Batch scraping

Submit up to 50 URLs in a single request. All URLs are processed in parallel. Each URL is a plain string, not an object.

```typescript
const batch = await spidra.batchScrape({
  urls: [
    "https://shop.example.com/product/1",
    "https://shop.example.com/product/2",
    "https://shop.example.com/product/3",
  ],
  prompt:   "Extract product name, price, and availability",
  output:   "json",
  useProxy: true,
});

for (const item of batch.items) {
  if (item.status === "completed") {
    console.log(item.url, item.result);
  } else if (item.status === "failed") {
    console.error(item.url, item.error);
  }
}
```

Item statuses: `pending`, `running`, `completed`, `failed`.

**Retry failed items:**

```typescript
const { batchId } = await spidra.startBatchScrape({
  urls: ["https://example.com/1", "https://example.com/2"],
  prompt: "Extract the page title",
});

// Later, after checking status
const result = await spidra.getBatchScrape(batchId);
if (result.failedCount > 0) {
  await spidra.retryBatchScrape(batchId);
}
```

**Cancel a running batch:**

```typescript
const { cancelledItems, creditsRefunded } = await spidra.cancelBatchScrape(batchId);
console.log(`Cancelled ${cancelledItems} items, refunded ${creditsRefunded} credits`);
```

**List past batches:**

```typescript
const { jobs, pagination } = await spidra.listBatchScrapes({ page: 1, limit: 20 });

for (const job of jobs) {
  console.log(job.uuid, job.status, `${job.completedCount}/${job.totalUrls}`);
}
```

## Crawling

Given a starting URL, Spidra discovers pages automatically according to your instruction and extracts structured data from each one.

```typescript
const job = await spidra.crawl({
  baseUrl:              "https://competitor.com/blog",
  crawlInstruction:     "Find all blog posts published in 2024",
  transformInstruction: "Extract the title, author, publish date, and a one-sentence summary",
  maxPages:             30,
  useProxy:             true,
});

for (const page of job.result) {
  console.log(page.url, page.data);
}
```

`transformInstruction` is optional. When omitted (and no `schema` is set), each page's `data` field contains the raw page markdown — no AI extraction is called and no token credits are charged for extraction.

**All crawl parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `baseUrl` | `string` | **Required.** Starting URL for the crawl. |
| `crawlInstruction` | `string` | Which pages to discover. Defaults to `"Find all pages on the website"`. |
| `transformInstruction` | `string` | What to extract from each page. Omit to get raw markdown with no AI charges. |
| `schema` | `object` | JSON Schema for structured per-page output. Root must be `type: "object"`. |
| `maxPages` | `number` | Cap on pages crawled. |
| `maxDepth` | `number` | Max link depth from the base URL. `0` = base URL only. |
| `includePaths` | `string[]` | Only crawl pages whose path matches one of these patterns. |
| `excludePaths` | `string[]` | Skip pages whose path matches any of these patterns. |
| `allowSubdomains` | `boolean` | Follow links to subdomains of the base domain. |
| `crawlEntireDomain` | `boolean` | Follow any link on the same root domain regardless of path. |
| `ignoreQueryParams` | `boolean` | Treat URLs differing only by query string as the same page. |
| `webhookUrl` | `string` | URL that receives POST notifications as the job progresses. |
| `useProxy` | `boolean` | Route requests through a residential proxy. |
| `proxyCountry` | `string` | Two-letter country code for geo-targeted proxy routing. |
| `cookies` | `string` | Cookie string for authenticated crawls. |

**Submit without waiting:**

```typescript
const { jobId } = await spidra.startCrawl({
  baseUrl:          "https://example.com/docs",
  crawlInstruction: "Find all documentation pages",
  maxPages:         50,
});

// Check status later
const status = await spidra.getCrawl(jobId);
```

**Limit depth and scope:**

```typescript
const job = await spidra.crawl({
  baseUrl:            "https://example.com/blog",
  crawlInstruction:   "Find all blog posts",
  maxDepth:           2,
  includePaths:       ["/blog/"],
  excludePaths:       ["/blog/tag/", "/blog/author/"],
  ignoreQueryParams:  true,
});
```

**Get signed download URLs for all crawled pages:**

Each page includes `html` and `markdown` fields with S3-signed URLs that expire after 1 hour.

```typescript
const { pages } = await spidra.crawlPages(jobId);

for (const page of pages) {
  console.log(page.url, page.status);
  // Download raw HTML:  page.html
  // Download markdown:  page.markdown
}
```

**Re-extract with a new instruction:**

Runs a new AI transformation over an existing completed crawl without re-crawling any pages. Charges credits for the transformation only.

```typescript
const { jobId: newJobId } = await spidra.crawlExtract(
  sourceJobId,
  "Extract only the product SKUs and prices as a CSV"
);

// Poll the new job manually
const result = await spidra.getCrawl(newJobId);
```

**Crawl history and stats:**

```typescript
const { jobs, total, page, totalPages } = await spidra.crawlHistory({
  page:  1,
  limit: 10,
});

const { total: totalCrawls } = await spidra.crawlStats();
```

**Get full job details:**

A flat snapshot of a crawl job's config and counters — the same data `crawlHistory()` returns per row, for one job.

```typescript
const details = await spidra.crawlJobDetails(jobId);
console.log(details.status, details.pages_crawled, details.credits_used);
```

> This endpoint returns raw database field names (`pages_crawled`, not `pagesCrawled`), unlike the rest of the SDK — same as `crawlHistory()`'s entries.

**Retry one page's AI transformation:**

If a single page's extraction failed or you want to re-run it, retry just that page instead of the whole crawl. Charges credits for that page's transformation only.

```typescript
const retry = await spidra.retryCrawlPage(jobId, pageId);
console.log(retry.data);
```

**Download crawl results as a zip:**

```typescript
const blob = await spidra.downloadCrawlResults(jobId, ["markdown", "data"]);
// write `blob` to disk, or stream it straight to a response
```

`include` defaults to `["html", "markdown", "data"]` if you omit it.

## Watching jobs (streaming results)

For long-running crawls and batches, `watchCrawl()`/`watchBatch()` give you each result as it lands instead of one snapshot at the end. They poll under the hood but only re-fetch page content when progress actually changes.

```typescript
const { jobId } = await spidra.startCrawl({
  baseUrl:              "https://competitor.com/blog",
  crawlInstruction:     "Find all blog posts",
  transformInstruction: "Extract title, author, and publish date",
  maxPages:             50,
});

const watcher = spidra.watchCrawl(jobId);

watcher.on("page", (page) => {
  // fires once per crawled page, as soon as it is available
  console.log(page.url, page.data);
});
watcher.on("snapshot", (status) => {
  if ("progress" in status && status.progress) {
    console.log(status.progress.message); // e.g. "Scraping (3/50) https://..."
  }
});
watcher.on("error", (err) => console.error(err));

const final = await watcher.wait(); // terminal response, or null if you called watcher.stop()
```

Batch works the same way, with an `item` event per finished URL:

```typescript
const { batchId } = await spidra.startBatchScrape({ urls, prompt: "Extract product data" });

const watcher = spidra.watchBatch(batchId);
watcher.on("item", (item) => console.log(item.url, item.status, item.result));
await watcher.wait();
```

Events: `snapshot` (every poll), `page`/`item` (each result exactly once — including ones that already existed when you started watching), `done` (job reached a terminal state), `error` (non-recoverable error or timeout). `watchCrawl()`/`watchBatch()` accept the same options as polling (`pollInterval`, `timeout`, `signal`) and `watcher.stop()` stops watching without cancelling the job.

## Logs

Scrape logs are stored for every job that runs through the API.

```typescript
// List logs with optional filters
const { logs, total } = await spidra.scrapeLogs({
  status:     "failed",        // "success" | "failed"
  searchTerm: "amazon.com",
  channel:    "api",           // "api" | "playground"
  dateStart:  "2024-01-01",
  dateEnd:    "2024-12-31",
  page:       1,
  limit:      20,
});

for (const log of logs) {
  console.log(log.urls[0]?.url, log.status, log.credits_used);
}
```

**Get a single log with full extraction result:**

```typescript
const log = await spidra.getScrapeLog("log-uuid");
console.log(log.result_data); // the full AI output for that job
```

## Usage statistics

Returns credit and request usage broken down by day or week.

```typescript
// Range options: "7d" | "30d" | "weekly"
const rows = await spidra.usage("30d");

for (const row of rows) {
  console.log(row.date, row.requests, row.credits, row.tokens);
}
```

## Retries and reliability

Transient failures — network blips, 502/503/504 gateway errors — are retried automatically with exponential backoff, so a single hiccup never fails your call. Both knobs are configurable on the client:

```typescript
const spidra = new SpidraClient({
  apiKey:        "spd_YOUR_API_KEY",
  maxRetries:    3,   // retry attempts for transient failures (default: 3, 0 disables)
  backoffFactor: 500, // base backoff in ms — delay is backoffFactor * 2^attempt (default: 500)
});
```

Safety rules the SDK follows so retries never double-charge you:

- 4xx client errors are never retried.
- Job submissions (POSTs) are only retried when the server explicitly rejected them (502/503) — never on network errors or 504s, where the job may already have been queued.
- When the server sends a `Retry-After` hint (e.g. a 503 `SERVICE_BUSY`), the SDK honors it instead of its own backoff.

## Error handling

Every API error throws a typed error class. Catch the specific class you care about or fall back to the base `SpidraError`.

```typescript
import {
  SpidraClient,
  SpidraError,
  SpidraAuthenticationError,
  SpidraPaymentRequiredError,
  SpidraInsufficientCreditsError,
  SpidraNotFoundError,
  SpidraValidationError,
  SpidraRateLimitError,
  SpidraServerError,
  SpidraJobError,
  SpidraTimeoutError,
} from "spidra";

try {
  await spidra.scrape({ urls: [{ url: "https://example.com" }], prompt: "..." });
} catch (err) {
  if (err instanceof SpidraAuthenticationError) {
    // 401: Missing or invalid Authorization header
    console.error("Check your API key");
  } else if (err instanceof SpidraInsufficientCreditsError) {
    // 403: Monthly credit limit reached
    console.error("Out of credits");
  } else if (err instanceof SpidraValidationError) {
    // 422: Bad request body — err.errors lists each problem
    console.error(err.errors);
  } else if (err instanceof SpidraRateLimitError) {
    // 429: Too many requests — metadata tells you exactly how long to wait
    console.error(`Rate limited. ${err.remaining}/${err.limit} left, retry in ${err.retryAfterMs}ms`);
  } else if (err instanceof SpidraJobError) {
    // The job itself failed or was cancelled (not a transport error)
    console.error(`Job ${err.jobId} ${err.jobStatus}: ${err.message}`);
  } else if (err instanceof SpidraTimeoutError) {
    // Your poll timeout elapsed — the job is still running server-side
    console.error(`Still running after ${err.timeoutMs}ms, check ${err.jobId} later`);
  } else if (err instanceof SpidraServerError) {
    // 5xx: Something went wrong on Spidra's side (already retried automatically)
    console.error("Server error");
  } else if (err instanceof SpidraError) {
    // Any other API error
    console.error(`${err.status}: ${err.message}`);
  }
}
```

Every error class exposes `err.status` (HTTP status code, or `0` for non-HTTP errors like job failures and timeouts) and `err.message`. API errors additionally carry `err.code` (machine-readable code like `SERVICE_BUSY` or `TOO_MANY_PENDING_JOBS`) and `err.details` (the raw error body). `SpidraRateLimitError` carries `limit`, `remaining`, `resetAt`, and `retryAfterMs` parsed from the response headers. Other classes: `SpidraPaymentRequiredError` (402) and `SpidraNotFoundError` (404).

## Verifying webhooks

Crawl jobs can push `crawl.page`, `crawl.completed`, and `crawl.failed` events to your `webhookUrl`. Spidra signs each delivery with HMAC-SHA256 in the `X-Spidra-Signature` header, and the SDK ships a verification helper:

```typescript
import { verifySpidraWebhook } from "spidra";

// Express example — use the RAW body, not the parsed JSON
app.post("/webhooks/spidra", express.raw({ type: "application/json" }), async (req, res) => {
  const valid = await verifySpidraWebhook(
    req.body, // raw bytes/string of the request body
    req.header("x-spidra-signature"),
    process.env.SPIDRA_WEBHOOK_SECRET!
  );

  if (!valid) return res.status(401).end();

  const event = JSON.parse(req.body.toString());
  if (event.event === "crawl.page") {
    console.log("New page:", event.page.url);
  }
  res.status(200).end();
});
```

The comparison is constant-time, and the helper works in Node, browsers, and edge runtimes (it uses WebCrypto). Always pass the raw request body — re-serializing parsed JSON produces different bytes and fails verification.

## AI agent integration

Spidra works well as a tool in AI agent pipelines. Here is an example using the Vercel AI SDK with Claude:

```typescript
import { generateText, tool } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { SpidraClient } from "spidra";
import { z } from "zod";

const spidra = new SpidraClient({ apiKey: "spd_YOUR_API_KEY" });

const result = await generateText({
  model:    anthropic("claude-opus-4-6"),
  maxSteps: 5,
  tools: {
    scrapeUrl: tool({
      description: "Fetch and extract structured data from a URL",
      parameters: z.object({
        url:    z.string().describe("The URL to scrape"),
        prompt: z.string().describe("What data to extract"),
      }),
      execute: async ({ url, prompt }) => {
        const result = await spidra.scrape({ urls: [{ url }], prompt });
        return JSON.stringify(result.content);
      },
    }),
  },
  prompt: "What are the top 3 trending repositories on GitHub today?",
});

console.log(result.text);
```

## Requirements

- Node.js 18 or later
- A Spidra API key ([sign up free](https://spidra.io))

## License

MIT
