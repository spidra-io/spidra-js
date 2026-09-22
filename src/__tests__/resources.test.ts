import { describe, expect, it } from "vitest";
import { z } from "zod";
import { SpidraClient } from "../client.js";
import { SpidraJobError } from "../lib/errors.js";
import { catchError, jsonResponse, sequenceFetch } from "./helpers.js";

const POLL = { pollInterval: 1 };

function makeClient(fetchImpl: typeof fetch) {
  return new SpidraClient({
    apiKey: "spd_test",
    baseUrl: "https://api.test",
    fetch: fetchImpl,
    backoffFactor: 1,
  });
}

describe("scrape.run", () => {
  it("submits, polls to completion, and returns the result", async () => {
    const fetchMock = sequenceFetch(
      jsonResponse(202, { status: "queued", jobId: "j1" }),
      jsonResponse(200, { status: "active", progress: { message: "scraping", progress: 50 } }),
      jsonResponse(200, {
        status: "completed",
        result: { content: { title: "Hi" }, data: [], screenshots: [], ai_extraction_failed: false },
        error: null,
      })
    );
    const client = makeClient(fetchMock);
    const job = await client.scrape.run({ urls: [{ url: "https://x.com" }], prompt: "extract title" }, POLL);
    expect(job.status).toBe("completed");
    expect(job.result.content).toEqual({ title: "Hi" });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("throws SpidraJobError with the jobId when the job fails", async () => {
    const fetchMock = sequenceFetch(
      jsonResponse(202, { status: "queued", jobId: "j9" }),
      jsonResponse(200, { status: "failed", error: "target blocked us" })
    );
    const client = makeClient(fetchMock);
    const err = await catchError(client.scrape.run({ urls: [{ url: "https://x.com" }], prompt: "p" }, POLL));
    expect(err).toBeInstanceOf(SpidraJobError);
    expect(err.jobId).toBe("j9");
    expect(err.jobStatus).toBe("failed");
    expect(err.message).toBe("target blocked us");
  });

  it("converts a Zod schema before submitting", async () => {
    const fetchMock = sequenceFetch(
      jsonResponse(202, { status: "queued", jobId: "j1" }),
      jsonResponse(200, { status: "completed", result: { content: {}, data: [] }, error: null })
    );
    const client = makeClient(fetchMock);
    const Product = z.object({ name: z.string() });
    await client.scrape.run({ urls: [{ url: "https://x.com" }], prompt: "p", schema: Product }, POLL);

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const submittedBody = JSON.parse(init.body as string);
    expect(submittedBody.schema.type).toBe("object");
    expect(submittedBody.schema.properties.name.type).toBe("string");
    expect(submittedBody.schema._zod).toBeUndefined();
  });
});

describe("crawl.run", () => {
  it("throws SpidraJobError when the crawl is cancelled", async () => {
    const fetchMock = sequenceFetch(
      jsonResponse(202, { status: "queued", jobId: "c1" }),
      jsonResponse(200, { status: "running", progress: { message: "crawling" } }),
      jsonResponse(200, { status: "cancelled" })
    );
    const client = makeClient(fetchMock);
    const err = await catchError(
      client.crawl.run({ baseUrl: "https://x.com", crawlInstruction: "all pages" }, POLL)
    );
    expect(err).toBeInstanceOf(SpidraJobError);
    expect(err.jobId).toBe("c1");
    expect(err.jobStatus).toBe("cancelled");
  });

  it("resolves with page results on completion", async () => {
    const fetchMock = sequenceFetch(
      jsonResponse(202, { status: "queued", jobId: "c2" }),
      jsonResponse(200, { status: "completed", result: [{ url: "https://x.com/a", data: { t: 1 } }] })
    );
    const client = makeClient(fetchMock);
    const job = await client.crawl.run({ baseUrl: "https://x.com", crawlInstruction: "all" }, POLL);
    expect(job.result).toHaveLength(1);
    expect(job.result[0].url).toBe("https://x.com/a");
  });
});

describe("batch.run", () => {
  it("returns the final response even when some items failed", async () => {
    const fetchMock = sequenceFetch(
      jsonResponse(202, { status: "queued", batchId: "b1", total: 2 }),
      jsonResponse(200, {
        status: "completed",
        totalUrls: 2,
        completedCount: 1,
        failedCount: 1,
        createdAt: "2026-07-13T00:00:00Z",
        finishedAt: "2026-07-13T00:01:00Z",
        items: [
          { uuid: "i1", url: "https://a.com", status: "completed", result: { ok: 1 } },
          { uuid: "i2", url: "https://b.com", status: "failed", error: "blocked" },
        ],
      })
    );
    const client = makeClient(fetchMock);
    const res = await client.batch.run({ urls: ["https://a.com", "https://b.com"], prompt: "p" }, POLL);
    expect(res.status).toBe("completed");
    expect(res.failedCount).toBe(1);
  });
});

describe("crawl endpoints added to catch the SDK up with the backend", () => {
  it("jobDetails() fetches the flat details snapshot", async () => {
    const fetchMock = sequenceFetch(
      jsonResponse(200, { id: "c1", base_url: "https://x.com", status: "completed", pages_crawled: 5 })
    );
    const client = makeClient(fetchMock);
    const details = await client.crawl.jobDetails("c1");
    expect(details.pages_crawled).toBe(5);
    expect(fetchMock.mock.calls[0][0]).toBe("https://api.test/crawl/job/c1");
  });

  it("retryPage() posts to the per-page retry endpoint", async () => {
    const fetchMock = sequenceFetch(
      jsonResponse(200, { success: true, data: { title: "Hi" }, tokensUsed: 50, creditsUsed: 1, message: "ok" })
    );
    const client = makeClient(fetchMock);
    const res = await client.crawl.retryPage("c1", "p1");
    expect(res.success).toBe(true);
    expect(res.data).toEqual({ title: "Hi" });
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.test/crawl/c1/retry/p1");
    expect(init.method).toBe("POST");
  });

  it("download() returns a blob and includes the `include` query param", async () => {
    const fetchMock = sequenceFetch(
      new Response(new Blob(["zip bytes"]), { status: 200, headers: { "Content-Type": "application/zip" } })
    );
    const client = makeClient(fetchMock);
    const blob = await client.crawl.download("c1", ["markdown", "data"]);
    expect(blob).toBeInstanceOf(Blob);
    expect(fetchMock.mock.calls[0][0]).toBe("https://api.test/crawl/c1/download?include=markdown,data");
  });
});

describe("search.run", () => {
  it("submits, polls to completion, and returns web results", async () => {
    const fetchMock = sequenceFetch(
      jsonResponse(202, { status: "queued", jobId: "s1" }),
      jsonResponse(200, { status: "active", progress: { message: "Searching the web...", progress: 0 } }),
      jsonResponse(200, {
        status: "completed",
        result: {
          success: true,
          data: { web: [{ title: "Hi", url: "https://x.com", position: 1 }] },
          stats: { durationMs: 1200 },
        },
        error: null,
      })
    );
    const client = makeClient(fetchMock);
    const job = await client.search.run({ query: "hello world" }, POLL);
    expect(job.status).toBe("completed");
    expect(job.result.data.web).toHaveLength(1);
    expect(job.result.data.web?.[0].title).toBe("Hi");
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });

  it("throws SpidraJobError with the jobId when the job fails", async () => {
    const fetchMock = sequenceFetch(
      jsonResponse(202, { status: "queued", jobId: "s9" }),
      jsonResponse(200, { status: "failed", error: "all engines blocked" })
    );
    const client = makeClient(fetchMock);
    const err = await catchError(client.search.run({ query: "hello world" }, POLL));
    expect(err).toBeInstanceOf(SpidraJobError);
    expect(err.jobId).toBe("s9");
    expect(err.jobStatus).toBe("failed");
    expect(err.message).toBe("all engines blocked");
  });

  it("passes includeDomains/excludeDomains and scrapeOptions through to the request body", async () => {
    const fetchMock = sequenceFetch(
      jsonResponse(202, { status: "queued", jobId: "s2" }),
      jsonResponse(200, {
        status: "completed",
        result: { success: true, data: { web: [] }, stats: { durationMs: 500 } },
        error: null,
      })
    );
    const client = makeClient(fetchMock);
    await client.search.run(
      {
        query: "espresso machine reviews",
        includeDomains: ["reddit.com"],
        scrapeOptions: { formats: ["markdown"], maxResults: 3 },
      },
      POLL
    );

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    const submittedBody = JSON.parse(init.body as string);
    expect(submittedBody.includeDomains).toEqual(["reddit.com"]);
    expect(submittedBody.scrapeOptions).toEqual({ formats: ["markdown"], maxResults: 3 });
  });
});
