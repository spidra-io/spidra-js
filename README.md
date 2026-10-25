# Spidra Node SDK

This is the official Node.js SDK for [Spidra](https://spidra.io). It searches the web, scrapes pages, runs browser actions, batch-processes URLs, and crawls entire sites.

Every result comes back as structured data, clean markdown ready to feed into an LLM pipeline, your own systems and research, or just store directly.

## Installation

To install the Spidra Node SDK, you can use npm:

```bash
npm install spidra
```

Get your API key at [app.spidra.io](https://app.spidra.io) under **API Keys**.

## Quick start

Create a client with your API key, then call whichever method fits what you need. Here's a scrape:

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
    - [Domain filtering](#domain-filtering)
    - [Scrape content from results](#scrape-content-from-results)
    - [Manual job control](#manual-job-control)
  - [Scraping](#scraping)
    - [Basic scrape](#basic-scrape)
    - [Structured output with JSON schema](#structured-output-with-json-schema)
    - [Structured output with Zod](#structured-output-with-zod)
    - [Geo-targeted scraping](#geo-targeted-scraping)
    - [Authenticated pages](#authenticated-pages)
    - [Browser actions](#browser-actions)
      - [When a step fails](#when-a-step-fails)
      - [Action results](#action-results)
    - [forEach: process every element on a page](#foreach-process-every-element-on-a-page)
      - [inline mode](#inline-mode)
      - [navigate mode](#navigate-mode)
      - [click mode](#click-mode)
      - [Pagination](#pagination)
      - [Per-element actions](#per-element-actions)
      - [itemPrompt vs top-level prompt](#itemprompt-vs-top-level-prompt)
    - [Manual job control](#manual-job-control-1)
    - [Poll options](#poll-options)
  - [Batch scraping](#batch-scraping)
  - [Parsing documents](#parsing-documents)
  - [Crawling](#crawling)
    - [Why a page was skipped](#why-a-page-was-skipped)
  - [Mapping a site](#mapping-a-site)
  - [Templates](#templates)
  - [Presets](#presets)
  - [Monitors](#monitors)
  - [Watching jobs (streaming results)](#watching-jobs-streaming-results)
  - [Logs](#logs)
  - [Usage statistics](#usage-statistics)
  - [Retries and reliability](#retries-and-reliability)
  - [Error handling](#error-handling)
  - [Verifying webhooks](#verifying-webhooks)
  - [AI agent integration](#ai-agent-integration)
  - [Requirements](#requirements)
  - [License](#license)

## Searching

Search runs a real query and returns structured results: titles, links, descriptions, thumbnails. It's the same data you'd get scraping a search engine yourself, minus the scraping. Unlike scrape/batch/crawl, a plain search usually resolves in a few seconds, often within the single `search()` call below with no polling at all.

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
| `research` | Academic papers from arXiv, PubMed, bioRxiv, and medRxiv |
| `developer` | GitHub issues and PRs. |

Each source is independent. If one comes back empty or is temporarily unavailable, the others are unaffected.

**All search parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `query` | `string` | **Required.** What to search for. |
| `sources` | `("web" \| "news" \| "images" \| "videos" \| "research" \| "developer")[]` | Which result types to request. Defaults to `["web"]`. |
| `limit` | `number` | Results per source, 1–20. Defaults to 10. |
| `page` | `number` | 1-indexed page number. Prefer `pageTokens` once you have one, it's a more reliable way to continue to the next page than a bare page number. |
| `pageTokens` | `Partial<Record<Source, string>>` | Opaque per-source token from a prior response's `nextPageTokens`, for reliably continuing to that source's next page. |
| `timeRange` | `"hour" \| "day" \| "week" \| "month" \| "year"` | Restricts results to a recency window. Support can vary by source and query, and a window that can't be honored is simply ignored. |
| `country` | `string` | Two-letter country code, or `"global"` / `"eu"` / `"asia"`, for localized results. |
| `includeDomains` | `string[]` | Only return `web` results from these domains. Mutually exclusive with `excludeDomains`. Doesn't apply to `research`/`developer`. |
| `excludeDomains` | `string[]` | Keep `web` results from these domains out. Mutually exclusive with `includeDomains`. Doesn't apply to `research`/`developer`. |
| `filetype` | `"pdf"` | Restricts results to PDFs. |
| `scrapeOptions` | `{ formats, maxResults? }` | Opt-in, also scrapes each web result's page content (see below). |

### Research and developer sources

`research` searches academic papers, and returns `authors` and `doi` alongside the usual fields:

```typescript
const result = await spidra.search({
  query: "transformer attention mechanisms",
  sources: ["research"],
});

for (const paper of result.data.research ?? []) {
  console.log(paper.title, paper.authors, paper.doi);
}
```

`developer` searches GitHub issues and PRs. Write the query the way you'd type it into GitHub's own search, qualifiers and all:

```typescript
const result = await spidra.search({
  query: "memory leak is:issue repo:vercel/next.js",
  sources: ["developer"],
});
```

> `includeDomains`, `excludeDomains`, and `filetype` only apply to `web`/`news`/`images`/`videos`. They're not supported on `research` or `developer`.

### Pagination and time range

Pass the previous response's `nextPageTokens` back as `pageTokens` to get the next page of a specific source:

```typescript
const page1 = await spidra.search({ query: "espresso machine reviews", limit: 10 });
const page2 = await spidra.search({
  query: "espresso machine reviews",
  pageTokens: page1.data.nextPageTokens,
});
```

`timeRange` narrows results to a recency window, useful for sources like `news` where older results matter less:

```typescript
const result = await spidra.search({
  query: "product launch",
  sources: ["news"],
  timeRange: "week",
});
```

### Domain filtering

Restrict `web` results to specific domains, or keep specific domains out. Pass one or the other, never both.

```typescript
const result = await spidra.search({
  query: "espresso machine reviews",
  includeDomains: ["reddit.com"],
});
```

### Scrape content from results

Add `scrapeOptions` to also fetch each web result's actual page content in the same call. No second request, no separate job to poll.

```typescript
const result = await spidra.search({
  query: "posthog before_send config",
  scrapeOptions: { formats: ["markdown"], maxResults: 5 },
});

result.data.web?.[0].markdown; // the scraped page's content, right there on the result
```

`markdown` is the clean page content. When a page was read by one of Spidra's site scrapers (Amazon, LinkedIn, Google Maps and others), the result also has a `structuredData` object with the page's fields.

This makes the search take as long as its slowest scraped page, not the usual few seconds. Real scraping isn't instant, and Spidra would rather you wait once on one job than build your own polling loop around N separate scrape jobs.

`maxResults` caps how many of the top-ranked web results get scraped; omit it to scrape all of them, up to a cap of 10. A result that fails to scrape or falls outside the time budget is simply left without `markdown`, not treated as an error.

Need AI extraction, a schema, or a screenshot instead of plain markdown? Scrape that specific URL directly with [`spidra.scrape()`](#scraping).

### Manual job control

If you'd rather not wait on the call at all, submit the search and check on it yourself whenever you're ready. Unlike `search()`, this never tries to resolve inline, it always returns a `jobId` immediately:

```typescript
const { jobId } = await spidra.startSearch({ query: "electric cars" });
const status = await spidra.getSearch(jobId);
```

## Scraping

All scrape jobs run asynchronously. `scrape()` submits a job and polls until it finishes. If you need more control, use `startScrape()` and `getScrape()` directly.

Up to 3 URLs can be passed per request and they are processed in parallel.

### Basic scrape

Give it a URL and a prompt describing what to pull out, and it comes back as structured JSON:

```typescript
const result = await spidra.scrape({
  urls: [{ url: "https://spidra.io/pricing" }],
  prompt: "Extract all pricing plans with name, price, and included features",
  output: "json",
});

console.log(result.content);
// { plans: [{ name: "Starter", price: "$9/mo", features: [...] }, ...] }
```

`output` is `"markdown"` (the default) or `"json"`, and `scrapeMode` is `"default"` (a real browser) or `"fast"` (a plain HTTP fetch). Any other value is rejected.

Each entry in `result.data` describes one URL, in the order you sent them:

- `url` is exactly the URL you sent. `canonicalUrl` appears when a site scraper used a cleaned link (tracking parameters removed, short link resolved).
- `markdownContent` is the page as readable markdown.
- `structuredData` is an object with the page's fields, present when the URL was handled by one of Spidra's site scrapers (Amazon, LinkedIn, Google Maps and others). The markdown does not include this data, so read it here.
- `warnings` lists anything you asked for that was not done, such as `"deliveryZip was not applied to this page."`
- `actionResults` reports each browser action, when the URL had any (see [Action results](#action-results)).

With `output: "json"` and no prompt or schema, a site scraper URL returns its `structuredData` as is, with no AI involved. Other URLs go through the default AI extraction. With several URLs, `result.content` is an array in request order.

`fullPageScreenshot: true` captures the whole page and implies a screenshot, so you don't need to send `screenshot: true` as well.

### Structured output with JSON schema

When you need a guaranteed shape, pass a `schema`. The API will enforce the structure and return `null` for any missing fields rather than hallucinating values.

> Define every field you want extracted. An untyped `object` with no `properties` gives the AI nothing to fill in, so those members come back empty.

```typescript
const result = await spidra.scrape({
  urls: [{ url: "https://github.careers" }],
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

> If your schema uses a keyword the API doesn't support (e.g. `anyOf`, `$ref`), the response includes `schema_warnings` listing what was ignored. The rest of the schema still applies.

### Structured output with Zod

You can pass a [Zod](https://zod.dev) (v4) schema directly instead of hand-writing JSON Schema. The SDK converts it automatically, and `result.content` is fully typed from your schema.

```typescript
import { z } from "zod";

const JobListing = z.object({
  title:   z.string(),
  company: z.string(),
  remote:  z.boolean().nullable(),
  skills:  z.array(z.string()),
});

const result = await spidra.scrape({
  urls:   [{ url: "https://github.careers" }],
  prompt: "Extract the job listing details",
  output: "json",
  schema: JobListing,
});

result.content.title; // typed as string, no casting needed
```

The same works for `batchScrape()` (types each item's `result`) and `crawl()` (types each page's `data`). Zod is an optional peer dependency, install it only if you use this (`npm install zod`). Passing `MySchema.shape` by mistake throws a helpful error.

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
  urls: [{ url: "https://app.spidra.io/dashboard" }],
  prompt: "Extract the monthly revenue and active user count",
  cookies: "session=abc123; auth_token=xyz789",
});
```

### Browser actions

Actions work with the page before it is captured: fill in a form, accept a cookie banner, open a menu, pick from a dropdown, scroll, or go through a list. They run in order, and the page is captured after the last one.

```typescript
const result = await spidra.scrape({
  urls: [
    {
      url: "https://quotes.toscrape.com/login",
      actions: [
        { type: "type",    selector: "#username", value: "demo" },
        { type: "type",    selector: "#password", value: "demo" },
        { type: "click",   selector: "input[type='submit']" },
        { type: "waitFor", selector: "a[href='/logout']" },
      ],
    },
  ],
  prompt: "List the first 3 quotes with their authors",
  output: "json",
});
```

**Available actions:**

| Action | Fields | What it does |
|--------|--------|--------------|
| `click` | `selector` | Click an element |
| `type` | `selector`, `value` (or `text`) | Fill a text field. Without `selector`, the first visible field |
| `check` / `uncheck` | `selector` | Tick or untick a checkbox |
| `hover` | `selector` | Move the mouse over an element, for example to open a menu |
| `select` | `selector`, `value` (or `option`) | Choose a dropdown option by its label or value. An array picks several |
| `press` | `key`, optional `selector` | Press a key such as `"Enter"`, `"Tab"`, `"Escape"` or `"Control+A"` |
| `wait` | `duration` | Pause for 1 to 30000 ms |
| `waitFor` | `selector`, optional `state` | Wait until an element is `"visible"` (default), `"attached"`, `"hidden"` or `"detached"` |
| `scroll` | `to` or `pixels` | Scroll to a percentage (`80` or `"80%"`), `"top"`, `"bottom"` or an element, or by a number of pixels |
| `scrollUntilEnd` | optional `maxScrolls`, `pause`, `clickSelector` | Keep scrolling (or clicking a "load more" button) until the page stops growing |
| `evaluate` | `script` | Run JavaScript in the page and return its value |
| `screenshot` | optional `fullPage` | Take a screenshot at this step |
| `forEach` | `observe` | Go through a set of elements and capture each one (see below) |

Type names are case-insensitive. `selector` takes a CSS selector, an XPath, or a plain-English description such as `"the Sign in button"`, which Spidra finds on the page for you. Every action except `forEach` also takes `timeout` (how long to look for the element, 100 to 30000 ms, default 10000) and `optional`.

```typescript
{ type: "click",  selector: "button[data-testid='submit']" }        // CSS
{ type: "click",  selector: "the Next page link" }                  // plain English
{ type: "select", selector: "#dropdown", value: "Option 2" }
{ type: "press",  selector: "#search", key: "Enter" }
{ type: "waitFor", selector: "#finish", timeout: 15000 }
{ type: "scroll", to: "bottom" }
{ type: "scrollUntilEnd", maxScrolls: 5, clickSelector: "the Load more button" }
{ type: "evaluate", script: "document.querySelectorAll('.quote').length" }
{ type: "screenshot", fullPage: true }
```

A URL can have up to 50 actions and 60 seconds of waiting in total (waits, `waitFor` timeouts and `scrollUntilEnd` pauses). A request that breaks a rule gets a 422 naming the action and the problem, before anything runs.

Instead of listing steps, you can give a URL one plain-English `instruction`, such as `"search for wireless headphones and open the first result"`. It always runs in a real browser. A URL takes `instruction` or `actions`, not both.

#### When a step fails

By default a step that can't be done fails the job, and failed jobs are free. `scrape()` throws a `SpidraJobError` whose message names the step and the reason:

```
Failed to scrape https://quotes.toscrape.com: Action 1 (click "#does-not-exist") failed: no element matches "#does-not-exist" (waited 1 seconds). Add "optional": true to that action to skip it when it can't be done.
```

Mark a step `optional: true` when it may not be there, like a cookie banner that only shows in some regions. If it fails, it is skipped and the rest run.

#### Action results

Each URL's entry in `result.data` has `actionResults`, one entry per action in order, and `result.warnings` lists anything that didn't go as asked without failing the job:

```typescript
const result = await spidra.scrape({
  urls: [
    {
      url: "https://quotes.toscrape.com",
      actions: [
        { type: "click", selector: "#cookie-banner .accept", optional: true, timeout: 1000 },
        { type: "evaluate", script: "document.querySelectorAll('.quote').length" },
        { type: "screenshot" },
      ],
    },
  ],
});

for (const step of result.data[0].actionResults ?? []) {
  console.log(step.index, step.type, step.status, step.result ?? step.screenshotUrl ?? step.error ?? "");
}
// 1 click skipped no element matches "#cookie-banner .accept" (waited 1 seconds).
// 2 evaluate ok 10
// 3 screenshot ok https://...png

console.log(result.warnings);
// [ 'Action 1 (click) was skipped: no element matches "#cookie-banner .accept" (waited 1 seconds).' ]
```

`status` is `"ok"`, `"skipped"` (an optional step that failed) or `"failed"`. `evaluate` returns the script's value in `result`, `scrollUntilEnd` returns `{ scrolls, stoppedBecause }`, and `screenshot` returns `screenshotUrl`.

The action types are exported (`BrowserAction` is a union with one member per action type, such as `ClickAction` or `ForEachAction`), so an array typed as `BrowserAction[]` is checked field by field. For actions you build at runtime, use `GenericBrowserAction`, where every field is optional and the API does the checking.

### forEach: process every element on a page

`forEach` finds a set of elements on the page and processes each one individually. It is the right tool when you need to collect data from a list of items, paginate through multiple pages, or click into each item's detail page. It must be the last action, and a URL can have only one.

> You don't need `forEach` if the data fits on a single page and is short, a plain `prompt` is simpler and works just as well.

**Use forEach when:**
- The list spans multiple pages and you need `pagination`
- You need to click into each item's detail page (`navigate` mode)
- You have 20+ items and want per-item AI extraction to stay consistent (`itemPrompt`)

| Field | What it does |
|-------|--------------|
| `observe` | Which elements to go through, in plain English, such as `"each product card"` |
| `mode` | `"click"` (default), `"inline"` or `"navigate"` |
| `captureSelector` | What to capture for each item: a CSS selector, XPath or description |
| `maxItems` | Most items across all pages, 1 to 50 (default 50) |
| `waitAfterClick` | Milliseconds to wait after clicking or opening an item, 0 to 10000 (default 2500) |
| `itemPrompt` | An extraction prompt run on each item on its own |
| `actions` | Actions to run on each item after it is opened, 10 at most and no `forEach` |
| `pagination` | `{ nextSelector, maxPages }` to move through results pages |

`result.data[0].forEachItems` says how many items were captured. When `observe` finds nothing and the whole page is returned instead, or the loop stops early, `result.warnings` says so.

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
    maxPages:     3,            // pages in total, counting the first (1 to 10, default 5)
  },
}
```

`maxItems` applies across all pages combined. The loop stops when you hit `maxItems`, run out of pages, or reach `maxPages`.

#### Per-element actions

Run additional browser actions on each item after navigating or clicking into it, before the content is captured. Useful for scrolling below the fold or expanding collapsed sections. Up to 10 actions, any type except `forEach`.

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
  urls: [{ url: "https://spidra.io" }],
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
  timeout:      600_000,     // max wait in ms before SpidraTimeoutError (default: null, waits until the job finishes)
  signal:       controller.signal, // stop waiting (the job itself keeps running)
  maxConsecutiveErrors: 3,   // transient errors (5xx/429/network) tolerated mid-poll (default: 3)
});
```

By default there is no timeout. These calls wait until the job reaches a terminal state, so long crawls just work. If you set a `timeout` and it fires, the SDK throws `SpidraTimeoutError`; the job keeps running server-side, so you can keep checking it with the matching `get*` method (`getScrape()`, `getBatchScrape()`, `getCrawl()`) or cancel it. Transient errors during polling (a 502 blip, a dropped connection) don't kill the wait, polling continues unless several happen in a row.

## Batch scraping

Submit up to 50 URLs in a single request. All URLs are processed in parallel. Each URL is a plain string, not an object.

```typescript
const batch = await spidra.batchScrape({
  urls: [
    "https://books.toscrape.com/catalogue/a-light-in-the-attic_1000/index.html",
    "https://books.toscrape.com/catalogue/tipping-the-velvet_999/index.html",
    "https://books.toscrape.com/catalogue/soumission_998/index.html",
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

Batch `output` defaults to `"markdown"`, and passing a `schema` forces `"json"`. When a URL was handled by one of Spidra's site scrapers, its item also has a `structuredData` object.

If some URLs fail (a site was down, a page timed out), you don't have to resubmit the whole batch. Re-queue just the failed items:

```typescript
const { batchId } = await spidra.startBatchScrape({
  urls: ["https://spidra.io/blog", "https://spidra.io/pricing"],
  prompt: "Extract the page title",
});

// Later, after checking status
const result = await spidra.getBatchScrape(batchId);
if (result.failedCount > 0) {
  await spidra.retryBatchScrape(batchId);
}
```

A retry keeps every option from the original batch. Cookies are never stored, so if the batch used them, pass them again with `retryBatchScrape(batchId, { cookies })`. Without them the retried URLs run logged out, and the response includes `warnings` saying so.

Cancelling stops everything still pending and refunds the credits for it:

```typescript
const { cancelledItems, creditsRefunded } = await spidra.cancelBatchScrape(batchId);
console.log(`Cancelled ${cancelledItems} items, refunded ${creditsRefunded} credits`);
```

To look back through batches you've already run:

```typescript
const { jobs, pagination } = await spidra.listBatchScrapes({ page: 1, limit: 20 });

for (const job of jobs) {
  console.log(job.uuid, job.status, `${job.completedCount}/${job.totalUrls}`);
}
```

## Parsing documents

`parse()` turns a document into Markdown, page by page: PDF, Word, Excel, PowerPoint, OpenDocument, RTF, EPUB, CSV and HTML. Send the file's bytes, a link, or a `fileId` from an earlier upload. Scanned pages are read with AI; pages with their own text aren't. It costs 1 credit per page parsed, plus AI tokens when you extract with a prompt or schema. Failed pages are free.

```typescript
import { readFile } from "node:fs/promises";

const doc = await spidra.parse(
  { file: await readFile("report.pdf"), fileName: "report.pdf" },
  { pages: "1-10", includePages: true }
);

console.log(doc.markdown);
for (const page of doc.pages ?? []) console.log(page.pageNumber, page.method); // "text" or "ocr"
```

Extract fields as JSON from a link:

```typescript
const invoice = await spidra.parse(
  { url: "https://example.com/invoice.pdf" },
  { prompt: "Invoice number, total and due date" }
);
console.log(invoice.json);
```

| Option | Description |
|--------|-------------|
| `mode` | `"auto"` (default) uses AI only for scanned pages, `"fast"` never uses AI, `"ocr"` uses AI on every page. |
| `pages` | PDF pages to parse, like `"1-5, 9"` or `"10-"`. |
| `maxPages` | Parse at most this many pages. |
| `includePages` | Return per-page Markdown in `pages`. |
| `pageMarkers` | Put `<!-- page N -->` between pages in `markdown`. |
| `prompt` / `schema` | Extract fields; the result is in `json`. |

Short documents answer in the same request; longer ones are polled until they finish, so `parse()` always returns the result. A document that can't be parsed throws `SpidraJobError`.

- `estimateParse(input, options)` returns the pages and credits without parsing or charging, and a `fileId` you can parse for 24 hours.
- `parseBatch(inputs, options)` parses several files, links and fileIds together.
- `uploadForParse(bytes, fileName)` uploads files up to 500 MB (direct uploads take up to 50 MB) and returns a `fileId`.
- `startParse()` / `getParse()` submit and check a job yourself; `deleteParseFile(fileId)` deletes an upload straight away.

## Crawling

Given a starting URL, Spidra discovers pages automatically according to your instruction and extracts structured data from each one.

```typescript
const job = await spidra.crawl({
  baseUrl:              "https://posthog.com/blog",
  crawlInstruction:     "Find all blog posts published in 2024",
  transformInstruction: "Extract the title, author, publish date, and a one-sentence summary",
  maxPages:             30,
  useProxy:             true,
});

for (const page of job.result) {
  console.log(page.url, page.data);
}
```

`transformInstruction` is optional. When omitted (and no `schema` is set), each page's `data` field contains the raw page markdown. No AI extraction is called and no token credits are charged for extraction.

**All crawl parameters:**

| Parameter | Type | Description |
|-----------|------|-------------|
| `baseUrl` | `string` | **Required.** Starting URL for the crawl. |
| `crawlInstruction` | `string` | Which pages to discover. Defaults to `"Find all pages on the website"`. |
| `transformInstruction` | `string` | What to extract from each page. Omit to get raw markdown with no AI charges. |
| `schema` | `object` | JSON Schema for structured per-page output. Root must be `type: "object"`. |
| `maxPages` | `number` | Most pages returned. Defaults to 5. Up to 100 on Free, 1,000 on Starter, 5,000 on Builder and 10,000 on Pro. |
| `maxDepth` | `number` | Max link depth from the base URL. `0` = base URL only. Omit for no limit. |
| `includePaths` | `string[]` | Only crawl pages whose path matches one of these patterns. |
| `excludePaths` | `string[]` | Skip pages whose path matches any of these patterns. |
| `allowSubdomains` | `boolean` | Follow links to subdomains of the base domain. |
| `crawlEntireDomain` | `boolean` | Follow any link on the same root domain regardless of path. |
| `ignoreQueryParams` | `boolean` | Treat URLs differing only by query string as the same page. |
| `webhookUrl` | `string` | URL that receives POST notifications as the job progresses. |
| `useProxy` | `boolean` | Route requests through a residential proxy. |
| `proxyCountry` | `string` | Two-letter country code for geo-targeted proxy routing. |
| `scrapeMode` | `"fast" \| "default"` | `"fast"` reads pages over HTTP and opens a browser only for pages that need one. `"default"` uses a browser for every page. |
| `cookies` | `string` | Cookie string for authenticated crawls. |
| `useSitemap` | `boolean` | Read the site's sitemap to find pages. Defaults to `true`. |
| `respectRobots` | `boolean` | Follow the site's robots.txt rules and its Crawl-delay. Defaults to `false`. |

Spidra reads category, listing and section pages to find the pages you asked for. Those pages are not returned and you are not charged for them. Each returned page has `depth` (clicks from `baseUrl`) and `parentUrl` (the page it was found on).

If you don't want to hold a connection open for a long crawl, submit it and check back whenever you like:

```typescript
const { jobId } = await spidra.startCrawl({
  baseUrl:          "https://docs.spidra.io",
  crawlInstruction: "Find all documentation pages",
  maxPages:         50,
});

// Check status later
const status = await spidra.getCrawl(jobId);
```

`maxDepth`, `includePaths`, and `excludePaths` keep a crawl from wandering off into pages you don't care about:

```typescript
const job = await spidra.crawl({
  baseUrl:            "https://spidra.io/blog",
  crawlInstruction:   "Find all blog posts",
  maxDepth:           2,
  includePaths:       ["/blog/"],
  excludePaths:       ["/blog/tag/", "/blog/author/"],
  ignoreQueryParams:  true,
});
```

`crawl()` returns every page, however large the crawl. The status endpoint keeps only the first 100 pages inline, so for bigger crawls `crawl()` reads the rest for you. When you poll yourself, read them in batches with `crawlPages(jobId, { offset, limit })` (up to 1,000 per call).

Each crawled page includes `html` and `markdown` fields with S3-signed URLs that expire after 1 hour:

```typescript
const { pages } = await spidra.crawlPages(jobId);

for (const page of pages) {
  console.log(page.url, page.status);
  // Download raw HTML:  page.html
  // Download markdown:  page.markdown
}
```

Crawled a site and want different information out of it? You don't have to re-crawl. This runs a new AI transformation over the already-crawled content and only charges for the transformation:

```typescript
const { jobId: newJobId } = await spidra.crawlExtract(
  sourceJobId,
  "Extract only the product SKUs and prices as a CSV"
);

// Poll the new job manually
const result = await spidra.getCrawl(newJobId);
```

Look back through crawls you've already run, or check your total count for the account:

```typescript
const { jobs, total, page, totalPages } = await spidra.crawlHistory({
  page:  1,
  limit: 10,
});

const { total: totalCrawls } = await spidra.crawlStats();
```

`crawlJobDetails()` gives you a flat snapshot of one crawl job's config and counters, the same data `crawlHistory()` returns per row:

```typescript
const details = await spidra.crawlJobDetails(jobId);
console.log(details.status, details.pages_crawled, details.credits_used);
```

> This endpoint returns raw database field names (`pages_crawled`, not `pagesCrawled`), unlike the rest of the SDK. Same as `crawlHistory()`'s entries.

If a single page's extraction failed or you want to re-run it, retry just that page instead of the whole crawl. It only charges credits for that page's transformation:

```typescript
const retry = await spidra.retryCrawlPage(jobId, pageId);
console.log(retry.data);
```

To get the raw files instead of working through the API, download everything a crawl produced as one zip:

```typescript
const blob = await spidra.downloadCrawlResults(jobId, ["markdown", "data"]);
// write `blob` to disk, or stream it straight to a response
```

`include` defaults to `["html", "markdown", "data"]` if you omit it.

### Why a page was skipped

When a crawl finishes, its report says how Spidra understood the instruction, how many pages it read only to find others, and every link it chose not to follow, with the reason and the page the link was on:

```typescript
const { report } = await spidra.crawlReport(jobId);

console.log(report?.understoodAs);       // "Individual blog posts"
console.log(report?.navigationPages);    // pages read to find them (free)
for (const s of report?.skipped ?? []) {
  console.log(s.reason, s.count, s.description);
}

// List the URLs for one reason, 200 at a time
const notRelevant = await spidra.crawlReport(jobId, { reason: "not_relevant", limit: 200, offset: 0 });
for (const u of notRelevant.report?.skippedUrls ?? []) {
  console.log(u.url, "found on", u.foundOn);
}
```

Reasons: `not_relevant`, `outside_domain`, `include_pattern`, `exclude_pattern`, `file_type`, `other_version_or_language`, `duplicate_page`, `redirected_off_site`, `robots_txt` and `action_link` (links like add to cart or log out). `report` is `null` while the crawl is still running and for crawls that ran before reports existed.

## Mapping a site

`map()` lists a site's page URLs without scraping them. It reads the sitemap and the links on the site's main pages, and answers in the same request (usually a few seconds). It costs 1 credit, and nothing when no URLs are found.

```typescript
const { links, total, scanned } = await spidra.map({
  url:    "https://docs.python.org/3/",
  search: "asyncio",   // optional: best matches first
  limit:  100,
});

for (const link of links) {
  console.log(link.url, link.title);
}
```

| Parameter | Type | Description |
|-----------|------|-------------|
| `url` | `string` | **Required.** The website to map. |
| `search` | `string` | Only return URLs related to these words, best matches first. |
| `limit` | `number` | Most URLs returned, 1 to 5000. Defaults to 500. |
| `sitemap` | `"include" \| "only" \| "skip"` | `"include"` reads the sitemap and page links, `"only"` the sitemap, `"skip"` the links. Defaults to `"include"`. |
| `includeSubdomains` | `boolean` | Include URLs on subdomains. |
| `ignoreQueryParams` | `boolean` | Treat URLs that differ only by query string as one. Defaults to `true`. |
| `respectRobots` | `boolean` | Leave out URLs the site's robots.txt disallows. |
| `cookies` | `string` | Cookie string for pages behind a login. |

`total` is how many URLs matched, `scanned` how many were found before the search filter. Map is a good first step before a batch scrape: pick the URLs you want, then scrape exactly those.

## Templates

Templates are ready-made jobs for common tasks, such as Google Maps leads, Amazon keyword rank or LinkedIn jobs. You fill in a few inputs and get back one row per result.

```typescript
// Find a template, then see its inputs
const { templates } = await spidra.listTemplates({ site: "google-maps" });
const template = await spidra.getTemplate("google-maps-leads");
console.log(template.inputs.map((i) => `${i.key}${i.required ? " (required)" : ""}`));

// What a run will cost, without running it (free)
const { credits } = await spidra.estimateTemplate("google-maps-leads", {
  inputs: { query: "dentist", areas: ["Ikeja, Lagos"] },
});

// Run it and wait for the rows
const run = await spidra.runTemplate("google-maps-leads", {
  inputs: { query: "dentist", areas: ["Ikeja, Lagos"] },
});
console.log(run.status, run.rowCount, run.creditsUsed);
// completed 20 1
console.log(run.rows?.[0]);
```

`runTemplate()` asks the API to wait first, so a quick run often finishes in that one call; longer ones are polled for you. A `partial` run (some pages failed) still returns its rows, with the failed pages in `failures`. A failed run throws `SpidraJobError`.

To manage the run yourself, use `startTemplateRun()` and `getTemplateRun(runId, { rows: false })` while it runs. `listTemplateRuns()` lists past runs, and `lookupAirports({ q: "lagos" })` finds the codes the Google Flights templates take.

## Presets

A preset saves a job so you can run it again with one call. It's either a template with its inputs, or any tool's request body.

```typescript
// Save a template preset
const { id } = await spidra.createPreset({
  kind: "template",
  name: "Dentists in Lekki",
  template: "google-maps-leads",
  inputs: { query: "dentist", areas: ["Lekki, Lagos"] },
});

// Or a tool preset: the request body for scrape, batch, crawl, map, search or parse
await spidra.createPreset({
  kind: "tool",
  name: "Python docs: asyncio pages",
  tool: "map",
  config: { url: "https://docs.python.org/3/", search: "asyncio", limit: 3 },
});

// Run it, changing inputs for this run only
const result = await spidra.runPreset(id, { overrides: { areas: ["Ikeja, Lagos"] } });
```

A template preset returns the template run (`result.run`); poll it with `getTemplateRun()`. A tool preset returns that tool's own response: a map's links straight away, or a scrape or crawl job ID to poll. `cookies` and `wait` are never stored in a preset.

`listPresets()`, `getPreset()`, `updatePreset()` and `deletePreset()` manage them.

## Monitors

A monitor runs a template, a preset or a list of pages on a schedule, compares each check with the last, and alerts you when something changes.

```typescript
const monitor = {
  name: "Docs page",
  sources: [{ kind: "urls" as const, urls: ["https://httpbin.org/uuid"] }],
  schedule: { every: "1w" as const, day: 1, at: "08:00", timezone: "Africa/Lagos" },
  alertOn: "page" as const,
  goal: "Only tell me if the uuid changes",
  notify: { webhook: { url: "https://example.com/hooks/spidra" } },
};

// What it will cost (free), then create it
console.log(await spidra.estimateMonitor(monitor));
// { creditsPerCheck: 1, checksPerMonth: 5, creditsPerMonth: 5, usesAi: false }

const { monitor: created } = await spidra.createMonitor(monitor);
```

The first check runs straight away and records the starting point without alerting (send `checkNow: false` to wait for the schedule). Webhooks are signed with `X-Spidra-Signature`; check them with `verifySpidraWebhook()`.

Then:

```typescript
await spidra.checkMonitorNow(created.id);                 // runs in the background
const { checks } = await spidra.listMonitorChecks(created.id);
const check = await spidra.getMonitorCheck(created.id, checks[0].id);
console.log(check.summary, check.sources?.[0]?.pages);    // what changed

await spidra.pauseMonitor(created.id);
await spidra.resumeMonitor(created.id);
await spidra.updateMonitor(created.id, { goal: null });   // send only what changes
await spidra.deleteMonitor(created.id);
```

`monitorLimits()` says how many monitors your plan allows and how often they can check. `testMonitorNotification({ notify })` sends a sample alert so you can check a webhook, Slack or Discord URL before saving.

## Watching jobs (streaming results)

For long-running crawls and batches, `watchCrawl()`/`watchBatch()` give you each result as it lands instead of one snapshot at the end. They poll under the hood but only re-fetch page content when progress actually changes.

```typescript
const { jobId } = await spidra.startCrawl({
  baseUrl:              "https://posthog.com/blog",
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

Events: `snapshot` (every poll), `page`/`item` (each result exactly once, including ones that already existed when you started watching), `done` (job reached a terminal state), `error` (non-recoverable error or timeout). `watchCrawl()`/`watchBatch()` accept the same options as polling (`pollInterval`, `timeout`, `signal`) and `watcher.stop()` stops watching without cancelling the job.

## Logs

Every run is logged, including ones made in the dashboard, and logs outlast the jobs themselves.

```typescript
// Scrape logs
const { logs, total } = await spidra.scrapeLogs({
  status:     "error",         // "success" | "error" | "in_progress"
  searchTerm: "amazon.com",
  channel:    "api",           // "api" | "playground"
  dateStart:  "2026-10-01",
  dateEnd:    "2026-10-31",
  page:       1,
  limit:      20,
});

for (const log of logs) {
  console.log(log.urls[0]?.url, log.status, log.credits_used);
}

// One log in full, with its result
const log = await spidra.getScrapeLog("log-uuid");
console.log(log.result_data);
```

Search, map and parse have their own logs with the same filters: `searchLogs()` and `getSearchLog()`, `mapLogs()` and `getMapLog()` (with the links it returned), and `parseLogs()`. A parse log's `jobId` opens the full result with `getParse()`. A log's `uuid` isn't the job's ID.

## Usage statistics

```typescript
// Plan, credits left this period and proxy bandwidth
const account = await spidra.account();
console.log(account.plan.name, account.credits.remaining);

// Credits, requests and tokens per day or week: "7d" | "30d" | "weekly"
const rows = await spidra.usage("30d");

// Credits per day, split by tool: "1d" | "7d" | "30d", or "custom" with dates
const days = await spidra.usageBreakdown({ range: "7d" });
console.log(days[0]);
// { label: "Oct 19", date: "2026-10-19", scrapeCredits: 74, crawlCredits: 0, searchCredits: 0, parseCredits: 0, mapCredits: 0 }
```

## Retries and reliability

Transient failures (network blips, 502/503/504 gateway errors) are retried automatically with exponential backoff, so a single hiccup never fails your call. Both knobs are configurable on the client:

```typescript
const spidra = new SpidraClient({
  apiKey:        "spd_YOUR_API_KEY",
  maxRetries:    3,   // retry attempts for transient failures (default: 3, 0 disables)
  backoffFactor: 500, // base backoff in ms, delay is backoffFactor * 2^attempt (default: 500)
});
```

Safety rules the SDK follows so retries never double-charge you:

- 4xx client errors are never retried.
- Job submissions (POSTs) are only retried when the server explicitly rejected them (502/503). Never on network errors or 504s, where the job may already have been queued.
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
  await spidra.scrape({ urls: [{ url: "https://spidra.io" }], prompt: "..." });
} catch (err) {
  if (err instanceof SpidraAuthenticationError) {
    // 401: Missing or invalid Authorization header
    console.error("Check your API key");
  } else if (err instanceof SpidraInsufficientCreditsError) {
    // 403: Monthly credit limit reached
    console.error("Out of credits");
  } else if (err instanceof SpidraValidationError) {
    // 422: Bad request body, err.errors lists each problem
    console.error(err.errors);
  } else if (err instanceof SpidraRateLimitError) {
    // 429: Too many requests, metadata tells you exactly how long to wait
    console.error(`Rate limited. ${err.remaining}/${err.limit} left, retry in ${err.retryAfterMs}ms`);
  } else if (err instanceof SpidraJobError) {
    // The job itself failed or was cancelled (not a transport error)
    console.error(`Job ${err.jobId} ${err.jobStatus}: ${err.message}`);
  } else if (err instanceof SpidraTimeoutError) {
    // Your poll timeout elapsed, the job is still running server-side
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

// Express example, use the RAW body, not the parsed JSON
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

The comparison is constant-time, and the helper works in Node, browsers, and edge runtimes (it uses WebCrypto). Always pass the raw request body. Re-serializing parsed JSON produces different bytes and fails verification.

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
