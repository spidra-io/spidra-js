import { describe, expect, it } from "vitest";
import { SpidraClient } from "../client.js";
import { SpidraJobError } from "../lib/errors.js";
import { jsonResponse, sequenceFetch } from "./helpers.js";

const makeClient = (fetchImpl: typeof fetch) => new SpidraClient({ apiKey: "spd_test", baseUrl: "https://api.test", fetch: fetchImpl, backoffFactor: 1 });

const done = { jobId: "j1", status: "completed", fileName: "a.pdf", sourceUrl: null, fileId: "f1", format: "PDF", totalPages: 2, pagesParsed: 2, creditsUsed: 2, markdown: "# Hi" };

describe("parse", () => {
  it("uploads a file as multipart with options and returns the result", async () => {
    const fetchMock = sequenceFetch(jsonResponse(200, done));
    const job = await makeClient(fetchMock).parse({ file: new Uint8Array([37, 80, 68, 70]), fileName: "a.pdf" }, { pages: "1-2", mode: "fast" });
    expect(job.markdown).toBe("# Hi");
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.test/parse");
    expect(init.body).toBeInstanceOf(FormData);
    const form = init.body as FormData;
    expect((form.get("file") as File).name).toBe("a.pdf");
    expect(JSON.parse(form.get("options") as string)).toEqual({ pages: "1-2", mode: "fast", wait: true });
    expect((init.headers as Record<string, string>)["Content-Type"]).toBeUndefined();
  });

  it("sends a link as JSON and polls when the document takes longer", async () => {
    const fetchMock = sequenceFetch(
      jsonResponse(202, { ...done, status: "queued", markdown: undefined }),
      jsonResponse(200, { ...done, status: "running", markdown: undefined }),
      jsonResponse(200, done)
    );
    const job = await makeClient(fetchMock).parse({ url: "https://x.com/a.pdf" }, {}, { pollInterval: 1 });
    expect(job.status).toBe("completed");
    expect(JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string)).toEqual({ url: "https://x.com/a.pdf", wait: true });
    expect(fetchMock.mock.calls[1][0]).toBe("https://api.test/parse/j1");
  });

  it("throws SpidraJobError when the document can't be parsed", async () => {
    const fetchMock = sequenceFetch(jsonResponse(200, { ...done, status: "failed", error: "This PDF is password protected." }));
    const err = await makeClient(fetchMock).parse({ fileId: "f1" }).catch(e => e);
    expect(err).toBeInstanceOf(SpidraJobError);
    expect(err.message).toBe("This PDF is password protected.");
  });

  it("estimateParse is a dry run", async () => {
    const fetchMock = sequenceFetch(jsonResponse(200, { status: "estimate", fileId: "f1", fileName: "a.pdf", format: "PDF", totalPages: 9, pagesToParse: 3, credits: 3 }));
    const est = await makeClient(fetchMock).estimateParse({ fileId: "f1" }, { pages: "1-3" });
    expect(est.credits).toBe(3);
    expect(JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string)).toEqual({ fileId: "f1", pages: "1-3", dryRun: true });
  });

  it("parseBatch sends files, links and fileIds together and returns results", async () => {
    const fetchMock = sequenceFetch(
      jsonResponse(202, { batchId: "b1", documents: [] }),
      jsonResponse(200, { batchId: "b1", status: "completed", counts: {}, creditsUsed: 3, documents: [] }),
      jsonResponse(200, { batchId: "b1", status: "completed", counts: { completed: 3 }, creditsUsed: 3, documents: [done] })
    );
    const batch = await makeClient(fetchMock).parseBatch(
      [{ file: new Uint8Array([1]), fileName: "x.docx" }, { url: "https://x.com/a.pdf" }, { fileId: "f9" }],
      {},
      { pollInterval: 1 }
    );
    expect(batch.documents[0].markdown).toBe("# Hi");
    const form = (fetchMock.mock.calls[0][1] as RequestInit).body as FormData;
    expect(form.getAll("files")).toHaveLength(1);
    expect(JSON.parse(form.get("urls") as string)).toEqual(["https://x.com/a.pdf"]);
    expect(JSON.parse(form.get("fileIds") as string)).toEqual(["f9"]);
    expect(fetchMock.mock.calls[2][0]).toBe("https://api.test/parse/batch/b1?include=results");
  });

  it("uploadForParse prepares an upload and PUTs the bytes", async () => {
    const fetchMock = sequenceFetch(
      jsonResponse(201, { fileId: "big1", uploadUrl: "https://s3.test/put", method: "PUT", expiresIn: 900 }),
      new Response(null, { status: 200 })
    );
    const { fileId } = await makeClient(fetchMock).uploadForParse(new Uint8Array(10), "big.pdf");
    expect(fileId).toBe("big1");
    expect(JSON.parse((fetchMock.mock.calls[0][1] as RequestInit).body as string)).toEqual({ fileName: "big.pdf", size: 10 });
    expect(fetchMock.mock.calls[1][0]).toBe("https://s3.test/put");
    expect((fetchMock.mock.calls[1][1] as RequestInit).method).toBe("PUT");
  });
});
