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
      jsonResponse(200, { status: "running", progress: { message: "crawling", pagesCrawled: 1, maxPages: 5 } }),
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
