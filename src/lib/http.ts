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

  private async throwError(status: number, message: string): Promise<never> {
    switch (status) {
      case 401: throw new SpidraAuthenticationError(message);
      case 403: throw new SpidraInsufficientCreditsError(message);
      case 429: throw new SpidraRateLimitError(message);
      case 500: throw new SpidraServerError(message);
      default:  throw new SpidraError(status, message);
    }
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
      return this.throwError(res.status, error.message ?? res.statusText);
    }

    return res.json() as Promise<T>;
  }

  async get<T>(path: string): Promise<T> {
    const res = await this.fetch(`${this.baseUrl}${path}`, {
      headers: { "x-api-key": this.apiKey },
    });

    if (!res.ok) {
      const error = await res.json().catch(() => ({ message: res.statusText })) as { message?: string };
      return this.throwError(res.status, error.message ?? res.statusText);
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
      return this.throwError(res.status, error.message ?? res.statusText);
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

/** Thrown when the API key is missing or invalid (HTTP 401). */
export class SpidraAuthenticationError extends SpidraError {
  constructor(message: string) {
    super(401, message);
    this.name = "SpidraAuthenticationError";
  }
}

/** Thrown when the account has run out of credits (HTTP 403). */
export class SpidraInsufficientCreditsError extends SpidraError {
  constructor(message: string) {
    super(403, message);
    this.name = "SpidraInsufficientCreditsError";
  }
}

/** Thrown when the rate limit is exceeded (HTTP 429). */
export class SpidraRateLimitError extends SpidraError {
  constructor(message: string) {
    super(429, message);
    this.name = "SpidraRateLimitError";
  }
}

/** Thrown on an unrecoverable server-side error (HTTP 500). */
export class SpidraServerError extends SpidraError {
  constructor(message: string) {
    super(500, message);
    this.name = "SpidraServerError";
  }
}
