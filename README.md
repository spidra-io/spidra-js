# Spidra Node SDK

The official Node.js SDK for [Spidra](https://spidra.io) that allows you to scrape pages, run browser actions, batch-process URLs, and crawl entire sites. All results come back as structured data ready to feed into your LLM pipelines or store directly.

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

const job = await spidra.scrape.run({
  urls: [{ url: "https://news.ycombinator.com" }],
  prompt: "List the top 5 stories with title, points, and comment count",
  output: "json",
});

console.log(job.result.content);
```

## Table of contents

- [Spidra Node SDK](#spidra-node-sdk)
  - [Installation](#installation)
  - [Quick start](#quick-start)
  - [Table of contents](#table-of-contents)
  - [Scraping](#scraping)
    - [Basic scrape](#basic-scrape)
    - [Structured output with JSON schema](#structured-output-with-json-schema)
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
  - [Logs](#logs)
  - [Usage statistics](#usage-statistics)
  - [Error handling](#error-handling)
  - [AI agent integration](#ai-agent-integration)

## Scraping

All scrape jobs run asynchronously. The `run()` method submits a job and polls until it finishes. If you need more control, use `submit()` and `get()` directly.

Up to 3 URLs can be passed per request and they are processed in parallel.

### Basic scrape

```typescript
const job = await spidra.scrape.run({
  urls: [{ url: "https://example.com/pricing" }],
  prompt: "Extract all pricing plans with name, price, and included features",
  output: "json",
});

console.log(job.result.content);
// { plans: [{ name: "Starter", price: "$9/mo", features: [...] }, ...] }
```

### Structured output with JSON schema

When you need a guaranteed shape, pass a `schema`. The API will enforce the structure and return `null` for any missing fields rather than hallucinating values.

```typescript
const job = await spidra.scrape.run({
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

### Geo-targeted scraping

Pass `useProxy: true` and a `proxyCountry` code to route the request through a specific country. Useful for geo-restricted content or localized pricing.

```typescript
const job = await spidra.scrape.run({
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
const job = await spidra.scrape.run({
  urls: [{ url: "https://app.example.com/dashboard" }],
  prompt: "Extract the monthly revenue and active user count",
  cookies: "session=abc123; auth_token=xyz789",
});
```

### Browser actions

Actions let you interact with the page before the scrape runs. They execute in order, and the scrape happens after all actions complete.

```typescript
const job = await spidra.scrape.run({
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
const job = await spidra.scrape.run({
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

Use `submit()` and `get()` when you want to manage polling yourself, or when you want to fire-and-forget and check back later.

```typescript
// Submit a job and get the jobId immediately
const { jobId } = await spidra.scrape.submit({
  urls: [{ url: "https://example.com" }],
  prompt: "Extract the main headline",
});

// Check status at any point
const status = await spidra.scrape.get(jobId);

if (status.status === "completed") {
  console.log(status.result.content);
} else if (status.status === "failed") {
  console.error(status.error);
}
```

Job statuses: `queued`, `waiting`, `active`, `completed`, `failed`.

### Poll options

`scrape.run()`, `batch.run()`, and `crawl.run()` accept an optional second argument to control polling behavior.

```typescript
const job = await spidra.scrape.run(params, {
  pollInterval: 3000,    // ms between status checks (default: 3000)
  timeout:      120_000, // max wait time in ms before throwing (default: 120000)
});
```

## Batch scraping

Submit up to 50 URLs in a single request. All URLs are processed in parallel. Each URL is a plain string, not an object.

```typescript
const batch = await spidra.batch.run({
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
const { batchId } = await spidra.batch.submit({
  urls: ["https://example.com/1", "https://example.com/2"],
  prompt: "Extract the page title",
});

// Later, after checking status
const result = await spidra.batch.get(batchId);
if (result.failedCount > 0) {
  await spidra.batch.retry(batchId);
}
```

**Cancel a running batch:**

```typescript
const { cancelledItems, creditsRefunded } = await spidra.batch.cancel(batchId);
console.log(`Cancelled ${cancelledItems} items, refunded ${creditsRefunded} credits`);
```

**List past batches:**

```typescript
const { jobs, pagination } = await spidra.batch.list({ page: 1, limit: 20 });

for (const job of jobs) {
  console.log(job.uuid, job.status, `${job.completedCount}/${job.totalUrls}`);
}
```

## Crawling

Given a starting URL, Spidra discovers pages automatically according to your instruction and extracts structured data from each one.

```typescript
const job = await spidra.crawl.run({
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

**Submit without waiting:**

```typescript
const { jobId } = await spidra.crawl.submit({
  baseUrl:              "https://example.com/docs",
  crawlInstruction:     "Find all documentation pages",
  transformInstruction: "Extract the page title and main content summary",
  maxPages:             50,
});

// Check status later
const status = await spidra.crawl.get(jobId);
```

**Get signed download URLs for all crawled pages:**

Each page includes `html_url` and `markdown_url` pointing to S3-signed URLs that expire after 1 hour.

```typescript
const { pages } = await spidra.crawl.pages(jobId);

for (const page of pages) {
  console.log(page.url, page.status);
  // Download raw HTML: page.html_url
  // Download markdown: page.markdown_url
}
```

**Re-extract with a new instruction:**

Runs a new AI transformation over an existing completed crawl without re-crawling any pages. Charges credits for the transformation only.

```typescript
const { jobId: newJobId } = await spidra.crawl.extract(
  sourceJobId,
  "Extract only the product SKUs and prices as a CSV"
);

// Poll the new job manually
const result = await spidra.crawl.get(newJobId);
```

**Crawl history and stats:**

```typescript
const { jobs, total, page, totalPages } = await spidra.crawl.history({
  page:  1,
  limit: 10,
});

const { total: totalCrawls } = await spidra.crawl.stats();
```

## Logs

Scrape logs are stored for every job that runs through the API.

```typescript
// List logs with optional filters
const { logs, total } = await spidra.logs.list({
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
const log = await spidra.logs.get("log-uuid");
console.log(log.result_data); // the full AI output for that job
```

## Usage statistics

Returns credit and request usage broken down by day or week.

```typescript
// Range options: "7d" | "30d" | "weekly"
const rows = await spidra.usage.get("30d");

for (const row of rows) {
  console.log(row.date, row.requests, row.credits, row.tokens);
}
```

## Error handling

Every API error throws a typed error class. Catch the specific class you care about or fall back to the base `SpidraError`.

```typescript
import {
  SpidraClient,
  SpidraError,
  SpidraAuthenticationError,
  SpidraInsufficientCreditsError,
  SpidraRateLimitError,
  SpidraServerError,
} from "spidra";

try {
  await spidra.scrape.run({ urls: [{ url: "https://example.com" }], prompt: "..." });
} catch (err) {
  if (err instanceof SpidraAuthenticationError) {
    // 401: No x-api-key header sent
    console.error("Check your API key");
  } else if (err instanceof SpidraInsufficientCreditsError) {
    // 403: Invalid API key, or monthly credit limit reached
    // Check err.message to distinguish: "Invalid token or API key" vs credits exhausted
    console.error("Out of credits or invalid API key");
  } else if (err instanceof SpidraRateLimitError) {
    // 429: Too many requests
    console.error("Rate limited, back off and retry");
  } else if (err instanceof SpidraServerError) {
    // 500: Something went wrong on Spidra's side
    console.error("Server error, try again");
  } else if (err instanceof SpidraError) {
    // Any other API error
    console.error(`${err.status}: ${err.message}`);
  }
}
```

All error classes expose `err.status` (HTTP status code) and `err.message`.

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
        const job = await spidra.scrape.run({ urls: [{ url }], prompt });
        return JSON.stringify(job.result.content);
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
