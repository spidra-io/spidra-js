import { describe, expect, it } from "vitest";
import { SpidraClient } from "../client.js";
import { SpidraJobError } from "../lib/errors.js";
import { catchError, jsonResponse, networkError, sequenceFetch } from "./helpers.js";

const POLL = { pollInterval: 1 };

function makeClient(fetchImpl: typeof fetch) {
  return new SpidraClient({ apiKey: "spd_test", baseUrl: "https://api.test", fetch: fetchImpl, backoffFactor: 1 });
}

const call = (fetchMock: ReturnType<typeof sequenceFetch>, i: number) => {
  const [url, init] = fetchMock.mock.calls[i] as [string, RequestInit];
  return { url, method: init.method, body: init.body ? JSON.parse(init.body as string) : undefined };
};

const run = (status: string, extra: Record<string, unknown> = {}) => ({
  status: "success",
  run: { runId: "r1", template: "google-maps-leads", status, inputs: {}, ...extra },
});

describe("templates", () => {
  it("runTemplate returns straight away when the API's wait finished the run", async () => {
    const fetchMock = sequenceFetch(jsonResponse(200, run("completed", { rowCount: 1, rows: [{ title: "A" }] })));
    const result = await makeClient(fetchMock).runTemplate("google-maps-leads", { inputs: { query: "dentist" } }, POLL);
    expect(result.rows).toEqual([{ title: "A" }]);
    expect(call(fetchMock, 0)).toMatchObject({
      url: "https://api.test/templates/google-maps-leads/runs",
      method: "POST",
      body: { inputs: { query: "dentist" }, wait: true },
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("runTemplate polls without rows, then fetches the rows once", async () => {
    const fetchMock = sequenceFetch(
      jsonResponse(202, run("running")),
      jsonResponse(200, run("running")),
      jsonResponse(200, run("completed")),
      jsonResponse(200, run("completed", { rows: [{ title: "A" }, { title: "B" }] }))
    );
    const result = await makeClient(fetchMock).runTemplate("google-maps-leads", { inputs: {} }, POLL);
    expect(result.rows).toHaveLength(2);
    expect(call(fetchMock, 1).url).toBe("https://api.test/template-runs/r1?rows=false");
    expect(call(fetchMock, 3).url).toBe("https://api.test/template-runs/r1");
  });

  it("treats a partial run as finished and returns it", async () => {
    const fetchMock = sequenceFetch(
      jsonResponse(202, run("running")),
      jsonResponse(200, run("partial")),
      jsonResponse(200, run("partial", { rows: [{ title: "A" }], failures: [{ url: "u", error: "e" }] }))
    );
    const result = await makeClient(fetchMock).runTemplate("google-maps-leads", { inputs: {} }, POLL);
    expect(result.status).toBe("partial");
    expect(result.failures).toHaveLength(1);
  });

  it("throws SpidraJobError with the runId when a run fails", async () => {
    const fetchMock = sequenceFetch(jsonResponse(200, run("failed", { error: "Every page failed." })));
    const err = await catchError(makeClient(fetchMock).runTemplate("google-maps-leads", { inputs: {} }, POLL));
    expect(err).toBeInstanceOf(SpidraJobError);
    expect(err.jobId).toBe("r1");
    expect(err.message).toBe("Every page failed.");
  });

  it("listTemplates sends filters and drops the envelope", async () => {
    const fetchMock = sequenceFetch(jsonResponse(200, { status: "success", templates: [], categories: [], sites: [] }));
    const result = await makeClient(fetchMock).listTemplates({ site: "amazon", q: "rank" });
    expect(result).toEqual({ templates: [], categories: [], sites: [] });
    expect(call(fetchMock, 0).url).toBe("https://api.test/templates?site=amazon&q=rank");
  });

  it("lookupAirports joins codes with commas", async () => {
    const fetchMock = sequenceFetch(jsonResponse(200, { status: "success", airports: [{ code: "JFK" }] }));
    await makeClient(fetchMock).lookupAirports({ codes: ["JFK", "LHR"] });
    expect(call(fetchMock, 0).url).toBe("https://api.test/templates/lookups/airports?codes=JFK%2CLHR");
  });
});

describe("presets", () => {
  it("createPreset returns the id", async () => {
    const fetchMock = sequenceFetch(
      jsonResponse(201, { status: "success", message: "Preset saved.", data: { uuid: "p1", id: "p1" } })
    );
    const result = await makeClient(fetchMock).createPreset({
      kind: "tool",
      name: "asyncio pages",
      tool: "map",
      config: { url: "https://docs.python.org/3/" },
    });
    expect(result).toEqual({ id: "p1" });
  });

  it("updatePreset sends PATCH", async () => {
    const fetchMock = sequenceFetch(jsonResponse(200, { status: "success", message: "Preset updated." }));
    await makeClient(fetchMock).updatePreset("p1", { name: "New name" });
    expect(call(fetchMock, 0)).toMatchObject({ url: "https://api.test/presets/p1", method: "PATCH", body: { name: "New name" } });
  });

  it("runPreset returns the tool's own response without the status envelope", async () => {
    const fetchMock = sequenceFetch(
      jsonResponse(200, { status: "success", links: [{ url: "u" }], total: 1, presetId: "p1", tool: "map" })
    );
    const result = await makeClient(fetchMock).runPreset("p1", { overrides: { limit: 5 } });
    expect(result).toEqual({ links: [{ url: "u" }], total: 1, presetId: "p1", tool: "map" });
  });
});

describe("monitors", () => {
  const monitor = { id: "m1", name: "Docs page", status: "active" };

  it("createMonitor returns the monitor and recipients", async () => {
    const fetchMock = sequenceFetch(jsonResponse(201, { status: "success", monitor, recipients: [] }));
    const result = await makeClient(fetchMock).createMonitor({ sources: [{ kind: "urls", urls: ["https://x.com"] }] });
    expect(result.monitor.id).toBe("m1");
    expect(call(fetchMock, 0)).toMatchObject({ url: "https://api.test/monitors", method: "POST" });
  });

  it("pause, resume, check now and delete hit the right paths", async () => {
    const fetchMock = sequenceFetch(
      jsonResponse(200, { status: "success", monitor: { ...monitor, status: "paused" } }),
      jsonResponse(200, { status: "success", monitor }),
      jsonResponse(202, { status: "queued", message: "Checking now." }),
      jsonResponse(200, { status: "success" })
    );
    const client = makeClient(fetchMock);
    expect((await client.pauseMonitor("m1")).status).toBe("paused");
    expect((await client.resumeMonitor("m1")).status).toBe("active");
    expect(await client.checkMonitorNow("m1")).toEqual({ message: "Checking now." });
    await client.deleteMonitor("m1");
    expect(fetchMock.mock.calls.map((_c, i) => `${call(fetchMock, i).method} ${call(fetchMock, i).url}`)).toEqual([
      "POST https://api.test/monitors/m1/pause",
      "POST https://api.test/monitors/m1/resume",
      "POST https://api.test/monitors/m1/check",
      "DELETE https://api.test/monitors/m1",
    ]);
  });

  it("does not blind-retry a PATCH after a network failure", async () => {
    const fetchMock = sequenceFetch(networkError(), jsonResponse(200, { status: "success", monitor, recipients: [] }));
    await catchError(makeClient(fetchMock).updateMonitor("m1", { name: "x" }));
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe("logs and usage", () => {
  it("searchLogs passes filters and returns data", async () => {
    const fetchMock = sequenceFetch(jsonResponse(200, { status: "success", data: { logs: [], total: 0 } }));
    const result = await makeClient(fetchMock).searchLogs({ status: "error", limit: 5 });
    expect(result).toEqual({ logs: [], total: 0 });
    expect(call(fetchMock, 0).url).toBe("https://api.test/search-logs?status=error&limit=5");
  });

  it("usageBreakdown sends the range and dates", async () => {
    const fetchMock = sequenceFetch(jsonResponse(200, { status: "success", data: [] }));
    await makeClient(fetchMock).usageBreakdown({ range: "custom", startDate: "2026-10-01", endDate: "2026-10-07" });
    expect(call(fetchMock, 0).url).toBe(
      "https://api.test/usage-stats/breakdown?range=custom&startDate=2026-10-01&endDate=2026-10-07"
    );
  });

  it("cancelSearch sends DELETE", async () => {
    const fetchMock = sequenceFetch(jsonResponse(200, { status: "cancelled", jobId: "s1" }));
    await makeClient(fetchMock).cancelSearch("s1");
    expect(call(fetchMock, 0)).toMatchObject({ url: "https://api.test/search/s1", method: "DELETE" });
  });
});

describe("validation errors", () => {
  it("turns { field, message } errors into readable strings", async () => {
    const fetchMock = sequenceFetch(
      jsonResponse(422, {
        status: "error",
        code: "INVALID_INPUT",
        message: "Some inputs need fixing.",
        errors: [{ field: "areas", message: "Areas is required." }],
      })
    );
    const err = await catchError(makeClient(fetchMock).runTemplate("google-maps-leads", { inputs: {} }, POLL));
    expect(err.errors).toEqual(["areas: Areas is required."]);
    expect(err.code).toBe("INVALID_INPUT");
  });
});
