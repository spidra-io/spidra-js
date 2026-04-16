export interface ScrapeLogsParams {
  status?: "success" | "failed";
  searchTerm?: string;
  limit?: number;
  page?: number;
}

export interface ScrapeLog {
  id: string;
  url: string;
  prompt: string;
  status: "success" | "failed";
  creditsUsed: number;
  createdAt: string;
}

export interface ScrapeLogsResponse {
  logs: ScrapeLog[];
  total: number;
  page: number;
  limit: number;
}
