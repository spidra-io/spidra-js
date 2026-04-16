import type { SpidraConfig } from "../types/client.js";

export class HttpClient {
  private apiKey: string;
  private baseUrl: string;
  private fetch: typeof fetch;

  constructor(config: SpidraConfig) {
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl ?? "https://api.spidra.io/api";
    this.fetch = config.fetch ?? globalThis.fetch;
  }

  async post<T>(path: string, body: unknown): Promise<T> {
    const res = await this.fetch(`${this.baseUrl}${path}`, {
      method: "POST",
      headers: {
        "x-api-key": this.apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const error = await res.json().catch(() => ({ message: res.statusText })) as { message?: string };
      throw new SpidraError(res.status, error.message ?? res.statusText);
    }

    return res.json() as Promise<T>;
  }

  async get<T>(path: string): Promise<T> {
    const res = await this.fetch(`${this.baseUrl}${path}`, {
      headers: { "x-api-key": this.apiKey },
    });

    if (!res.ok) {
      const error = await res.json().catch(() => ({ message: res.statusText })) as { message?: string };
      throw new SpidraError(res.status, error.message ?? res.statusText);
    }

    return res.json() as Promise<T>;
  }

  async delete<T>(path: string): Promise<T> {
    const res = await this.fetch(`${this.baseUrl}${path}`, {
      method: "DELETE",
      headers: { "x-api-key": this.apiKey },
    });

    if (!res.ok) {
      const error = await res.json().catch(() => ({ message: res.statusText })) as { message?: string };
      throw new SpidraError(res.status, error.message ?? res.statusText);
    }

    return res.json() as Promise<T>;
  }
}

export class SpidraError extends Error {
  constructor(
    public readonly status: number,
    message: string
  ) {
    super(message);
    this.name = "SpidraError";
  }
}
