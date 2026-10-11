import { describe, expect, it, vi } from "vitest";
import { SpidraClient } from "../client.js";
import { SpidraValidationError } from "../lib/errors.js";
import { expandTemplate, readPath } from "../lib/bulk.js";
import { catchError, jsonResponse, sequenceFetch } from "./helpers.js";

const POLL = { pollInterval: 1 };
const params = {
  template: "https://example.com/jobs?q={title}&l={location}",
  variables: { title: ["nurse", "cook"], location: ["Columbus, OH"] },
  itemsPath: "jobs",
  dedupeBy: "id",
};

function makeClient(fetchImpl: typeof fetch) {
  return new SpidraClient({ apiKey: "spd_test", baseUrl: "https://api.test", fetch: fetchImpl, backoffFactor: 1 });
}

/** One batch item: a page whose result lists `ids` as jobs. */
const page = (url: string, ids: string[], creditsUsed = 1) => ({
  uuid: url, url, jobId: null, status: "completed", result: { jobs: ids.map(id => ({ id })) }, creditsUsed, startedAt: null, finishedAt: null, screenshotUrl: null,
});
const failedPage = (url: string) => ({ ...page(url, []), status: "failed", result: null, creditsUsed: 0 });
const batch = (items: unknown[]) => jsonResponse(200, { status: "completed", totalUrls: items.length, completedCount: items.length, failedCount: 0, createdAt: "", finishedAt: "", items });
const queued = (batchId: string) => jsonResponse(202, { status: "queued", batchId, total: 0 });

describe("expandTemplate", () => {
  it("builds every combination and URL-encodes values", () => {
    expect(expandTemplate(params.template, params.variables)).toEqual([
      "https://example.com/jobs?q=nurse&l=Columbus%2C%20OH",
      "https://example.com/jobs?q=cook&l=Columbus%2C%20OH",
    ]);
  });

  it("uses a repeated placeholder consistently and ignores unused variables", () => {
    expect(expandTemplate("https://x.com/{a}/{a}", { a: ["1"], unused: ["z"] })).toEqual(["https://x.com/1/1"]);
  });

  it("rejects a template with no placeholders or a placeholder with no values", async () => {
    const noPlaceholder = await catchError(Promise.resolve().then(() => expandTemplate("https://x.com", {})));
    expect(noPlaceholder).toBeInstanceOf(SpidraValidationError);
    const noValues = await catchError(Promise.resolve().then(() => expandTemplate("https://x.com/{a}", { a: [] })));
    expect(noValues).toBeInstanceOf(SpidraValidationError);
    expect((noValues as SpidraValidationError).errors[0]).toContain("a");
  });
});

describe("readPath", () => {
  it("reads nested paths and returns undefined for missing ones", () => {
    expect(readPath({ data: { items: [1] } }, "data.items")).toEqual([1]);
    expect(readPath({ data: null }, "data.items")).toBeUndefined();
    expect(readPath(null, "jobs")).toBeUndefined();
  });
});

describe("estimateBulk", () => {
  it("is one credit per page and flags AI tokens when a prompt or schema is set", () => {
    const client = makeClient(sequenceFetch(jsonResponse(200, {})));
    expect(client.estimateBulk(params)).toEqual({ pages: 2, batches: 1, credits: 2, aiTokensExtra: false });
    expect(client.estimateBulk({ ...params, prompt: "extract jobs" }).aiTokensExtra).toBe(true);
    expect(client.estimateBulk({ ...params, variables: { title: Array(45).fill("a"), location: ["x"] } }).batches).toBe(2);
  });
});

describe("bulkScrape", () => {
  it("merges pages, removes duplicates, counts failures and sums credits", async () => {
    const urls = expandTemplate(params.template, params.variables);
    const fetchMock = sequenceFetch(queued("b1"), batch([page(urls[0], ["1", "2", "3"]), page(urls[1], ["3", "4"])]));
    const onBatch = vi.fn();
    const result = await makeClient(fetchMock).bulkScrape({ ...params, onBatch }, POLL);
    expect(result.items.map(i => (i as { id: string }).id).sort()).toEqual(["1", "2", "3", "4"]);
    expect(result.stats).toEqual({ pages: 2, failedPages: 0, rawItems: 5, uniqueItems: 4, duplicatesRemoved: 1, creditsUsed: 2 });
    expect(onBatch).toHaveBeenCalledWith({ pagesDone: 2, pagesTotal: 2, uniqueItems: 4, creditsUsed: 2 });
  });

  it("counts a failed page and does not charge for it", async () => {
    const urls = expandTemplate(params.template, params.variables);
    const fetchMock = sequenceFetch(queued("b1"), batch([page(urls[0], ["1"]), failedPage(urls[1])]));
    const result = await makeClient(fetchMock).bulkScrape(params, POLL);
    expect(result.stats).toMatchObject({ failedPages: 1, uniqueItems: 1, creditsUsed: 1 });
  });

  it("keeps items that have no dedupe key instead of dropping them", async () => {
    const url = "https://example.com/jobs?q=nurse&l=Columbus%2C%20OH";
    const keyless = { ...page(url, []), result: { jobs: [{ title: "no id" }, { title: "also no id" }] } };
    const result = await makeClient(sequenceFetch(queued("b1"), batch([keyless]))).bulkScrape({ ...params, variables: { title: ["nurse"], location: ["Columbus, OH"] } }, POLL);
    expect(result.items).toHaveLength(2);
  });

  it("runs pages in batches of 40 and stops once the target is reached", async () => {
    const titles = Array.from({ length: 41 }, (_, i) => `t${i}`);
    const urls = expandTemplate(params.template, { title: titles, location: ["x"] });
    const firstBatch = urls.slice(0, 40).map((u, i) => page(u, [`id${i}`]));
    const fetchMock = sequenceFetch(queued("b1"), batch(firstBatch), queued("b2"), batch([page(urls[40], ["id40"])]));
    const result = await makeClient(fetchMock).bulkScrape({ ...params, variables: { title: titles, location: ["x"] }, target: 10 }, POLL);
    expect(result.stats.pages).toBe(40);
    expect(result.stats.uniqueItems).toBe(40);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("refuses to run more pages than maxPages, before sending any request", async () => {
    const fetchMock = sequenceFetch(jsonResponse(200, {}));
    const error = await catchError(makeClient(fetchMock).bulkScrape({ ...params, maxPages: 1 }, POLL));
    expect(error).toBeInstanceOf(SpidraValidationError);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
