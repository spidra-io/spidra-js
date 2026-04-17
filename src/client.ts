import { HttpClient } from "./lib/http.js";
import { ScrapeResource } from "./resources/scrape.js";
import { BatchResource } from "./resources/batch.js";
import { CrawlResource } from "./resources/crawl.js";
import { LogsResource } from "./resources/logs.js";
import { UsageResource } from "./resources/usage.js";
import type { SpidraConfig } from "./types/client.js";

export class SpidraClient {
  readonly scrape: ScrapeResource;
  readonly batch: BatchResource;
  readonly crawl: CrawlResource;
  readonly logs: LogsResource;
  readonly usage: UsageResource;

  constructor(config: SpidraConfig) {
    const http = new HttpClient(config);
    this.scrape = new ScrapeResource(http);
    this.batch = new BatchResource(http);
    this.crawl = new CrawlResource(http);
    this.logs = new LogsResource(http);
    this.usage = new UsageResource(http);
  }
}
