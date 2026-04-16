# spidra

Official JavaScript / TypeScript SDK for the [Spidra](https://spidra.io) web scraping API.

## Installation

```bash
npm install spidra
```

## Quick start

```typescript
import { SpidraClient } from "spidra";

const spidra = new SpidraClient({ apiKey: "your-api-key" });

const job = await spidra.scrape.run({
  urls: [{ url: "https://news.ycombinator.com" }],
  prompt: "List the top 5 stories with title, points, and comment count",
  output: "json",
  useProxy: true,
});

console.log(job.result.content);
```

Get your API key at [app.spidra.io](https://app.spidra.io) → Settings → API Keys.

---

## Client configuration

```typescript
const spidra = new SpidraClient({
  apiKey: "your-api-key",

  // Optional: override the base URL (e.g. for a future API version)
  baseUrl: "https://api.spidra.io/api",

  // Optional: bring your own fetch (useful for testing or custom middleware)
  fetch: customFetch,
});
```

---

## Scraping

### `scrape.run()` — submit and wait

Submits a scrape job and polls until it completes. Returns the full result.

```typescript
const job = await spidra.scrape.run({
  urls: [{ url: "https://example.com" }],
  prompt: "Extract the main heading and summary",
  output: "json",
  useProxy: true,
});

console.log(job.result.content);
```

**With a JSON schema** for guaranteed output shape:

```typescript
const job = await spidra.scrape.run({
  urls: [{ url: "https://jobs.example.com/senior-engineer" }],
  prompt: "Extract job listing details",
  output: "json",
  schema: {
    type: "object",
    required: ["title", "company", "remote"],
    properties: {
      title: { type: "string" },
      company: { type: "string" },
      remote: { type: ["boolean", "null"] },
      salary_min: { type: ["number", "null"] },
      salary_max: { type: ["number", "null"] },
      skills: { type: "array", items: { type: "string" } },
    },
  },
});
```

**With geo-targeting:**

```typescript
const job = await spidra.scrape.run({
  urls: [{ url: "https://www.amazon.de/gp/bestsellers" }],
  prompt: "List the top 10 products with name and price",
  useProxy: true,
  proxyCountry: "de", // 50+ country codes supported
});
```

**With session cookies** (for pages behind a login):

```typescript
const job = await spidra.scrape.run({
  urls: [{ url: "https://app.example.com/dashboard" }],
  prompt: "Extract monthly revenue and active user count",
  cookies: "session=abc123; auth_token=xyz789",
});
```

**With browser actions** (clicks, form fills, scrolling):

```typescript
const job = await spidra.scrape.run({
  urls: [
    {
      url: "https://example.com",
      actions: [
        { type: "click", selector: "#accept-cookies" },
        { type: "wait", duration: 1000 },
        { type: "scroll", to: "80%" },
      ],
    },
  ],
  prompt: "Extract the product listings",
});
```

### `scrape.submit()` / `scrape.get()` — manual control

```typescript
// Submit
const { jobId } = await spidra.scrape.submit({
  urls: [{ url: "https://example.com" }],
  prompt: "Extract the headline",
});

// Poll yourself
const status = await spidra.scrape.get(jobId);
if (status.status === "completed") {
  console.log(status.result.content);
}
```

### Poll options

Both `scrape.run()`, `batch.run()`, and `crawl.run()` accept an optional second argument:

```typescript
await spidra.scrape.run(params, {
  pollInterval: 3000,  // ms between status checks (default: 3000)
  timeout: 120_000,    // max wait time in ms (default: 120000)
});
```

---

## Batch scraping

Process up to 50 URLs in parallel.

```typescript
const batch = await spidra.batch.run({
  urls: [
    "https://shop.example.com/product/1",
    "https://shop.example.com/product/2",
    "https://shop.example.com/product/3",
  ],
  prompt: "Extract product name, price, and availability",
  output: "json",
  useProxy: true,
});

for (const item of batch.items) {
  if (item.status === "completed") {
    console.log(item.url, item.result);
  }
}
```

**Retry failed items:**

```typescript
const { batchId } = await spidra.batch.submit({ urls: [...], prompt: "..." });

// later...
await spidra.batch.retry(batchId);
```

**Cancel a batch:**

```typescript
await spidra.batch.cancel(batchId);
```

---

## Crawling

Discover and extract from an entire website automatically.

```typescript
const job = await spidra.crawl.run({
  baseUrl: "https://competitor.com/blog",
  crawlInstruction: "Find all blog posts published in 2024",
  transformInstruction: "Extract the title, author, publish date, and a one-sentence summary",
  maxPages: 30,
  useProxy: true,
});

for (const page of job.result) {
  console.log(page.url, page.data);
}
```

**Get crawled pages with signed download URLs:**

```typescript
const { pages } = await spidra.crawl.pages(jobId);
// each page has html_url and markdown_url for raw content download
```

**Re-extract from an existing crawl** with a new instruction (no re-crawling):

```typescript
await spidra.crawl.extract(jobId, "Extract only the product prices and SKUs");
```

---

## Scrape logs

```typescript
const { logs, total } = await spidra.logs.list({
  status: "failed",
  searchTerm: "amazon.com",
  limit: 20,
  page: 1,
});
```

---

## Error handling

All API errors throw a `SpidraError` with a `status` (HTTP code) and `message`:

```typescript
import { SpidraClient, SpidraError } from "spidra";

try {
  await spidra.scrape.run({ ... });
} catch (err) {
  if (err instanceof SpidraError) {
    console.error(`API error ${err.status}: ${err.message}`);

    if (err.status === 403) {
      // credits exhausted
    }
    if (err.status === 429) {
      // rate limited — back off and retry
    }
  }
}
```

| Status | Meaning           |
| ------ | ----------------- |
| `400`  | Bad request       |
| `401`  | Invalid API key   |
| `403`  | Credits exhausted |
| `429`  | Rate limited      |
| `500`  | Server error      |

---

## Using with AI agents (Vercel AI SDK)

```typescript
import { generateText, tool } from "ai";
import { anthropic } from "@ai-sdk/anthropic";
import { SpidraClient } from "spidra";
import { z } from "zod";

const spidra = new SpidraClient({ apiKey: process.env.SPIDRA_API_KEY! });

const result = await generateText({
  model: anthropic("claude-opus-4-6"),
  maxSteps: 5,
  tools: {
    scrapeUrl: tool({
      description: "Fetch and extract structured data from a URL.",
      parameters: z.object({
        url: z.string(),
        prompt: z.string(),
      }),
      execute: async ({ url, prompt }) => {
        const job = await spidra.scrape.run({ urls: [{ url }], prompt });
        return JSON.stringify(job.result.content);
      },
    }),
  },
  prompt: "What are the top 3 trending repositories on GitHub today?",
});
```

---

## Requirements

- Node.js 18+
- A Spidra API key ([get one free](https://spidra.io))
