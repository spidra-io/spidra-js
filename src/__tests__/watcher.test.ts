import { describe, expect, it, vi } from "vitest";
import { BatchWatcher, CrawlWatcher } from "../lib/watcher.js";
import { SpidraNotFoundError, SpidraTimeoutError } from "../lib/errors.js";
import type { CrawlJobResponse, CrawlPage, CrawlPagesResponse } from "../types/crawl.js";
import type { BatchItem, BatchScrapeResponse } from "../types/batch.js";

const FAST = { pollInterval: 1 };

function page(id: string): CrawlPage {
  return { id, url: `https://x.com/${id}`, status: "success", error_message: null, html: null, markdown: null, created_at: "" };
}

function crawlSource(
  snapshots: CrawlJobResponse[],
  pageSets: CrawlPage[][]
): { get: ReturnType<typeof vi.fn>; pages: ReturnType<typeof vi.fn> } {
  let getCall = 0;
  let pagesCall = 0;
  return {
    get: vi.fn(async () => snapshots[Math.min(getCall++, snapshots.length - 1)]),
    pages: vi.fn(async (): Promise<CrawlPagesResponse> => ({
      pages: pageSets[Math.min(pagesCall++, pageSets.length - 1)],
    })),
  };
}

describe("CrawlWatcher", () => {
  it("emits each page exactly once and done on completion", async () => {
    const source = crawlSource(
      [
        { status: "running", progress: { message: "", pagesCrawled: 1, maxPages: 3 } },
        { status: "running", progress: { message: "", pagesCrawled: 2, maxPages: 3 } },
        { status: "completed", result: [] },
      ],
      [[page("p1")], [page("p1"), page("p2")], [page("p1"), page("p2"), page("p3")]]
    );

    const watcher = new CrawlWatcher(source, "c1", FAST);
    const pages: string[] = [];
    const done = vi.fn();
    watcher.on("page", (p) => pages.push(p.id));
    watcher.on("done", done);

    const final = await watcher.wait();
    expect(pages).toEqual(["p1", "p2", "p3"]);
    expect(done).toHaveBeenCalledTimes(1);
    expect(final?.status).toBe("completed");
  });

  it("only re-fetches pages when the crawled-page count changes", async () => {
    const source = crawlSource(
      [
        { status: "running", progress: { message: "", pagesCrawled: 1, maxPages: 3 } },
        { status: "running", progress: { message: "", pagesCrawled: 1, maxPages: 3 } },
        { status: "running", progress: { message: "", pagesCrawled: 1, maxPages: 3 } },
        { status: "completed", result: [] },
      ],
      [[page("p1")]]
    );

    const watcher = new CrawlWatcher(source, "c1", FAST);
    await watcher.wait();
    // first poll + terminal poll only — the two unchanged middle polls skip pages()
    expect(source.pages).toHaveBeenCalledTimes(2);
    expect(source.get).toHaveBeenCalledTimes(4);
  });

  it("emits snapshot on every poll", async () => {
    const source = crawlSource(
      [
        { status: "running", progress: { message: "", pagesCrawled: 1, maxPages: 2 } },
        { status: "completed", result: [] },
      ],
      [[page("p1")]]
    );
    const watcher = new CrawlWatcher(source, "c1", FAST);
    const snapshots = vi.fn();
    watcher.on("snapshot", snapshots);
    await watcher.wait();
    expect(snapshots).toHaveBeenCalledTimes(2);
  });

  it("stop() resolves wait() with null and emits no error", async () => {
    const source = crawlSource(
      [{ status: "running", progress: { message: "", pagesCrawled: 1, maxPages: 9 } }],
      [[page("p1")]]
    );
    const watcher = new CrawlWatcher(source, "c1", { pollInterval: 1000 });
    const errors = vi.fn();
    watcher.on("error", errors);
    setTimeout(() => watcher.stop(), 10);
    const final = await watcher.wait();
    expect(final).toBeNull();
    expect(errors).not.toHaveBeenCalled();
  });

  it("emits error and rejects wait() on non-recoverable errors", async () => {
    const source = {
      get: vi.fn(async () => {
        throw new SpidraNotFoundError("no such job");
      }),
      pages: vi.fn(),
    };
    const watcher = new CrawlWatcher(source, "missing", FAST);
    const errors = vi.fn();
    watcher.on("error", errors);
    await expect(watcher.wait()).rejects.toBeInstanceOf(SpidraNotFoundError);
    expect(errors).toHaveBeenCalledTimes(1);
  });

  it("emits SpidraTimeoutError when the watch timeout is exceeded", async () => {
    const source = crawlSource(
      [{ status: "running", progress: { message: "", pagesCrawled: 1, maxPages: 9 } }],
      [[page("p1")]]
    );
    const watcher = new CrawlWatcher(source, "c1", { pollInterval: 5, timeout: 12 });
    await expect(watcher.wait()).rejects.toBeInstanceOf(SpidraTimeoutError);
  });
});

function batchSnapshot(status: BatchScrapeResponse["status"], items: BatchItem[]): BatchScrapeResponse {
  return {
    status,
    totalUrls: items.length,
    completedCount: items.filter((i) => i.status === "completed").length,
    failedCount: items.filter((i) => i.status === "failed").length,
    createdAt: "",
    finishedAt: null,
    items,
  };
}

function batchItem(uuid: string, status: BatchItem["status"]): BatchItem {
  return { uuid, url: `https://x.com/${uuid}`, jobId: null, status, result: null, creditsUsed: 2, startedAt: null, finishedAt: null, screenshotUrl: null };
}

describe("BatchWatcher", () => {
  it("emits each finished item exactly once, then done", async () => {
    const snapshots = [
      batchSnapshot("running", [batchItem("i1", "completed"), batchItem("i2", "running")]),
      batchSnapshot("running", [batchItem("i1", "completed"), batchItem("i2", "failed")]),
      batchSnapshot("completed", [batchItem("i1", "completed"), batchItem("i2", "failed")]),
    ];
    let call = 0;
    const source = { get: vi.fn(async () => snapshots[Math.min(call++, snapshots.length - 1)]) };

    const watcher = new BatchWatcher(source, "b1", FAST);
    const items: string[] = [];
    watcher.on("item", (i) => items.push(`${i.uuid}:${i.status}`));

    const final = await watcher.wait();
    expect(items).toEqual(["i1:completed", "i2:failed"]);
    expect(final?.status).toBe("completed");
  });

  it("includes items already finished when watching starts", async () => {
    const source = {
      get: vi.fn(async () => batchSnapshot("completed", [batchItem("i1", "completed"), batchItem("i2", "completed")])),
    };
    const watcher = new BatchWatcher(source, "b1", FAST);
    const items = vi.fn();
    watcher.on("item", items);
    await watcher.wait();
    expect(items).toHaveBeenCalledTimes(2);
  });
});
