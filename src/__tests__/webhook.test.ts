import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { verifySpidraWebhook } from "../lib/webhook.js";

const SECRET = "whsec_test_secret";

/** Signs exactly the way the backend's fireWebhook() does. */
function sign(body: string, secret = SECRET): string {
  return `sha256=${createHmac("sha256", secret).update(body).digest("hex")}`;
}

describe("verifySpidraWebhook", () => {
  const body = JSON.stringify({ event: "crawl.completed", jobId: "c1", pagesScraped: 5, creditsUsed: 12 });

  it("accepts a valid signature", async () => {
    await expect(verifySpidraWebhook(body, sign(body), SECRET)).resolves.toBe(true);
  });

  it("accepts a Uint8Array body", async () => {
    await expect(verifySpidraWebhook(new TextEncoder().encode(body), sign(body), SECRET)).resolves.toBe(true);
  });

  it("accepts uppercase hex in the header", async () => {
    const sig = sign(body);
    const upper = `sha256=${sig.slice("sha256=".length).toUpperCase()}`;
    await expect(verifySpidraWebhook(body, upper, SECRET)).resolves.toBe(true);
  });

  it("rejects a tampered body", async () => {
    const tampered = body.replace("5", "6");
    await expect(verifySpidraWebhook(tampered, sign(body), SECRET)).resolves.toBe(false);
  });

  it("rejects a signature made with the wrong secret", async () => {
    await expect(verifySpidraWebhook(body, sign(body, "wrong"), SECRET)).resolves.toBe(false);
  });

  it("rejects malformed headers", async () => {
    await expect(verifySpidraWebhook(body, "not-a-signature", SECRET)).resolves.toBe(false);
    await expect(verifySpidraWebhook(body, "sha256=zzzz", SECRET)).resolves.toBe(false);
    await expect(verifySpidraWebhook(body, "md5=abcd", SECRET)).resolves.toBe(false);
  });

  it("rejects missing header or secret", async () => {
    await expect(verifySpidraWebhook(body, null, SECRET)).resolves.toBe(false);
    await expect(verifySpidraWebhook(body, undefined, SECRET)).resolves.toBe(false);
    await expect(verifySpidraWebhook(body, sign(body), "")).resolves.toBe(false);
  });

  it("rejects a re-serialized (non-raw) body when key order changed", async () => {
    const reordered = JSON.stringify({ jobId: "c1", event: "crawl.completed", pagesScraped: 5, creditsUsed: 12 });
    await expect(verifySpidraWebhook(reordered, sign(body), SECRET)).resolves.toBe(false);
  });
});
