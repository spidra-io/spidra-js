/**
 * Verifies a Spidra webhook signature (`X-Spidra-Signature: sha256=<hex>`,
 * an HMAC-SHA256 of the raw request body).
 *
 * Pass the raw body exactly as received — re-serializing the parsed JSON
 * will produce a different byte sequence and fail verification.
 *
 * ```ts
 * const ok = await verifySpidraWebhook(
 *   rawBody,
 *   req.headers["x-spidra-signature"],
 *   process.env.SPIDRA_WEBHOOK_SECRET!
 * );
 * ```
 */
export async function verifySpidraWebhook(
  rawBody: string | Uint8Array,
  signatureHeader: string | null | undefined,
  secret: string
): Promise<boolean> {
  if (!signatureHeader || !secret) return false;

  const match = /^sha256=([0-9a-f]{64})$/i.exec(signatureHeader.trim());
  if (!match) return false;

  const subtle = await getSubtleCrypto();
  const encoder = new TextEncoder();

  const key = await subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const body = typeof rawBody === "string" ? encoder.encode(rawBody) : rawBody;
  const computed = new Uint8Array(await subtle.sign("HMAC", key, body as BufferSource));

  return timingSafeEqual(computed, hexToBytes(match[1]));
}

async function getSubtleCrypto(): Promise<SubtleCrypto> {
  if (globalThis.crypto?.subtle) return globalThis.crypto.subtle;
  // Node 18 without a global WebCrypto — everything newer (and all edge runtimes) has globalThis.crypto
  const nodeCrypto = await import("node:crypto");
  return (nodeCrypto.webcrypto as Crypto).subtle;
}

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

/** Constant-time comparison so signature checks don't leak timing information. */
function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a[i] ^ b[i];
  }
  return diff === 0;
}
