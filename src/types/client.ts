export interface SpidraConfig {
  apiKey: string;
  /** Override the base URL. Defaults to https://api.spidra.io/api */
  baseUrl?: string;
  /** Bring your own fetch implementation */
  fetch?: typeof fetch;
}
