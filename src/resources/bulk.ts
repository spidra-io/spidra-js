import type { PollOptions } from "../lib/poll.js";
import { SpidraValidationError } from "../lib/errors.js";
import { BATCH_SIZE, DEFAULT_MAX_PAGES, chunk, estimateBulk, expandTemplate, readPath } from "../lib/bulk.js";
import type { BatchResource } from "./batch.js";
import type { BulkEstimate, BulkScrapeParams, BulkResult } from "../types/bulk.js";

export class BulkResource {
  constructor(private batch: BatchResource) {}

  /** How many pages and credits a bulk search would use, before you run it. */
  estimate(params: BulkScrapeParams): BulkEstimate {
    return estimateBulk(params);
  }

  /**
   * Expand a URL template across lists of values, scrape every page in batches,
   * and return one merged list with duplicates removed.
   */
  async run<T = Record<string, unknown>>(params: BulkScrapeParams, options?: PollOptions): Promise<BulkResult<T>> {
    const { template, variables, itemsPath, dedupeBy, target, maxPages = DEFAULT_MAX_PAGES, onBatch, ...scrapeParams } = params;
    const urls = expandTemplate(template, variables);
    if (urls.length > maxPages) {
      throw new SpidraValidationError("Too many pages.", [`This would scrape ${urls.length} pages. Raise maxPages above ${maxPages} to allow it.`]);
    }

    const unique = new Map<unknown, T>();
    const unkeyed: T[] = [];
    let rawItems = 0;
    let failedPages = 0;
    let creditsUsed = 0;
    let pagesDone = 0;

    for (const urlsInBatch of chunk(urls, BATCH_SIZE)) {
      const response = await this.batch.run({ ...scrapeParams, urls: urlsInBatch }, options);
      for (const item of response.items) {
        creditsUsed += item.creditsUsed;
        const list = item.status === "completed" ? readPath(item.result, itemsPath) : undefined;
        if (!Array.isArray(list)) {
          failedPages++;
          continue;
        }
        for (const entry of list) {
          rawItems++;
          const key = (entry as Record<string, unknown> | null)?.[dedupeBy];
          if (key == null) unkeyed.push(entry as T);
          else if (!unique.has(key)) unique.set(key, entry as T);
        }
      }
      pagesDone += urlsInBatch.length;
      const uniqueItems = unique.size + unkeyed.length;
      onBatch?.({ pagesDone, pagesTotal: urls.length, uniqueItems, creditsUsed });
      if (target !== undefined && uniqueItems >= target) break;
    }

    const items = [...unique.values(), ...unkeyed];
    return { items, stats: { pages: pagesDone, failedPages, rawItems, uniqueItems: items.length, duplicatesRemoved: rawItems - items.length, creditsUsed } };
  }
}
