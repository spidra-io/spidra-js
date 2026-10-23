import { describe, expect, expectTypeOf, it } from "vitest";
import { SpidraClient } from "../client.js";
import type {
  ActionResult,
  BrowserAction,
  GenericBrowserAction,
  ScrapeUrl,
} from "../types/scrape.js";
import { jsonResponse, sequenceFetch } from "./helpers.js";

const POLL = { pollInterval: 1 };

function makeClient(fetchImpl: typeof fetch) {
  return new SpidraClient({ apiKey: "spd_test", baseUrl: "https://api.test", fetch: fetchImpl, backoffFactor: 1 });
}

// Every action type in its documented shape. This array is checked by `tsc` (npm run typecheck).
const everyAction: BrowserAction[] = [
  { type: "click", selector: "#accept", optional: true, timeout: 5000 },
  { type: "click", selector: "the Sign in button" },
  { type: "type", selector: "input[name='q']", value: "headphones" },
  { type: "type", text: "headphones" },
  { type: "check", selector: "#terms" },
  { type: "uncheck", selector: "#newsletter" },
  { type: "hover", selector: "the Products menu" },
  { type: "select", selector: "#dropdown", value: "Option 2" },
  { type: "select", selector: "#multi", option: ["a", "b"] },
  { type: "press", key: "Enter" },
  { type: "press", key: "Tab", selector: "#search" },
  { type: "wait", duration: 1500 },
  { type: "waitFor", selector: ".results", state: "visible", timeout: 15000 },
  { type: "scroll", to: 80 },
  { type: "scroll", to: "bottom" },
  { type: "scroll", to: "the reviews section" },
  { type: "scroll", pixels: -400 },
  { type: "scrollUntilEnd", maxScrolls: 5, pause: 1000, clickSelector: "the Load more button" },
  { type: "evaluate", script: "document.title" },
  { type: "screenshot", fullPage: true },
  {
    type: "forEach",
    observe: "each quote",
    mode: "inline",
    captureSelector: ".quote",
    maxItems: 10,
    waitAfterClick: 0,
    itemPrompt: "Return the quote and author",
    actions: [{ type: "scroll", to: "50%" }],
    pagination: { nextSelector: "li.next > a", maxPages: 2 },
  },
];

describe("browser action types", () => {
  it("cover every action type", () => {
    const types = new Set(everyAction.map((a) => a.type));
    expect([...types].sort()).toEqual(
      [
        "check", "click", "evaluate", "forEach", "hover", "press", "screenshot",
        "scroll", "scrollUntilEnd", "select", "type", "uncheck", "wait", "waitFor",
      ].sort()
    );
  });

  it("reject wrong shapes when typed as BrowserAction", () => {
    // @ts-expect-error press needs a key
    const noKey: BrowserAction = { type: "press" };
    // @ts-expect-error evaluate needs a script
    const noScript: BrowserAction = { type: "evaluate" };
    // @ts-expect-error a forEach can't contain another forEach
    const nested: BrowserAction = { type: "forEach", observe: "x", actions: [{ type: "forEach", observe: "y" }] };
    // @ts-expect-error wait takes duration, not a selector
    const badWait: BrowserAction = { type: "wait", duration: 100, selector: "#x" };
    expect([noKey, noScript, nested, badWait]).toHaveLength(4);
  });

  it("still accept code written for the old shape and runtime-built actions", () => {
    const old: ScrapeUrl = {
      url: "https://x.com",
      actions: [
        { type: "click", value: "Accept all cookies button" },
        { type: "scroll", to: "80%" },
        { type: "wait", duration: 1000 },
      ],
    };
    const fromConfig: GenericBrowserAction = { type: "WaitForSelector", selector: ".x" };
    const mixed: ScrapeUrl = { url: "https://x.com", actions: [fromConfig, ...everyAction.slice(0, 2)] };
    expect(old.actions).toHaveLength(3);
    expect(mixed.actions).toHaveLength(3);
  });

  it("types actionResults entries", () => {
    expectTypeOf<ActionResult["status"]>().toEqualTypeOf<"ok" | "skipped" | "failed">();
  });
});

describe("scrape with actions", () => {
  it("sends actions exactly as given and returns actionResults and warnings", async () => {
    const fetchMock = sequenceFetch(
      jsonResponse(202, { status: "queued", jobId: "j1" }),
      jsonResponse(200, {
        status: "completed",
        result: {
          content: "# Quotes",
          data: [
            {
              url: "https://quotes.toscrape.com",
              success: true,
              actionResults: [
                { index: 1, type: "click", status: "skipped", durationMs: 120, error: 'no element matches "#nope" (waited 1 seconds).' },
                { index: 2, type: "evaluate", status: "ok", durationMs: 8, result: "Quotes to Scrape" },
              ],
              warnings: ['Action 1 (click "#nope") was skipped: no element matches "#nope" (waited 1 seconds).'],
            },
          ],
          screenshots: [],
          ai_extraction_failed: false,
          warnings: ['Action 1 (click "#nope") was skipped: no element matches "#nope" (waited 1 seconds).'],
        },
        error: null,
      })
    );
    const client = makeClient(fetchMock);
    const actions: BrowserAction[] = [
      { type: "click", selector: "#nope", optional: true, timeout: 1000 },
      { type: "evaluate", script: "document.title" },
      { type: "forEach", observe: "each quote", mode: "inline", pagination: { nextSelector: "li.next > a", maxPages: 2 } },
    ];
    const result = await client.scrape({ urls: [{ url: "https://quotes.toscrape.com", actions }] }, POLL);

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(init.body as string).urls[0].actions).toEqual(actions);
    expect(result.data[0].actionResults?.[0].status).toBe("skipped");
    expect(result.data[0].actionResults?.[1].result).toBe("Quotes to Scrape");
    expect(result.warnings).toHaveLength(1);
  });
});
