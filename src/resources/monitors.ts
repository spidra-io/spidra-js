import type { HttpClient } from "../lib/http.js";
import type {
  CreateMonitorParams,
  ListMonitorChecksParams,
  ListMonitorChecksResponse,
  Monitor,
  MonitorCheck,
  MonitorEstimate,
  MonitorLimits,
  MonitorParams,
  MonitorWriteResponse,
  TestNotificationParams,
  TestNotificationResponse,
  UpdateMonitorParams,
} from "../types/monitors.js";

export class MonitorsResource {
  constructor(private http: HttpClient) {}

  async list(): Promise<Monitor[]> {
    const res = await this.http.get<{ monitors: Monitor[] }>("/monitors");
    return res.monitors;
  }

  async create(params: CreateMonitorParams): Promise<MonitorWriteResponse> {
    const { monitor, recipients } = await this.http.post<MonitorWriteResponse>("/monitors", params);
    return { monitor, recipients: recipients ?? [] };
  }

  async estimate(params: MonitorParams): Promise<MonitorEstimate> {
    const { creditsPerCheck, checksPerMonth, creditsPerMonth, usesAi } = await this.http.post<MonitorEstimate>(
      "/monitors/estimate",
      params
    );
    return { creditsPerCheck, checksPerMonth, creditsPerMonth, usesAi };
  }

  async limits(): Promise<MonitorLimits> {
    const { plan, minIntervalMinutes, maxMonitors, used } = await this.http.get<MonitorLimits>("/monitors/limits");
    return { plan, minIntervalMinutes, maxMonitors, used };
  }

  testNotification(params: TestNotificationParams): Promise<TestNotificationResponse> {
    return this.http.post<TestNotificationResponse>("/monitors/test-notification", params);
  }

  async get(monitorId: string): Promise<Monitor> {
    const res = await this.http.get<{ monitor: Monitor }>(`/monitors/${monitorId}`);
    return res.monitor;
  }

  async update(monitorId: string, params: UpdateMonitorParams): Promise<MonitorWriteResponse> {
    const { monitor, recipients } = await this.http.patch<MonitorWriteResponse>(`/monitors/${monitorId}`, params);
    return { monitor, recipients: recipients ?? [] };
  }

  async delete(monitorId: string): Promise<void> {
    await this.http.delete(`/monitors/${monitorId}`);
  }

  /** Runs a check now. It runs in the background; read it with `listChecks()`. */
  async checkNow(monitorId: string): Promise<{ message: string }> {
    const { message } = await this.http.post<{ message: string }>(`/monitors/${monitorId}/check`, undefined);
    return { message };
  }

  async pause(monitorId: string): Promise<Monitor> {
    const res = await this.http.post<{ monitor: Monitor }>(`/monitors/${monitorId}/pause`, undefined);
    return res.monitor;
  }

  async resume(monitorId: string): Promise<Monitor> {
    const res = await this.http.post<{ monitor: Monitor }>(`/monitors/${monitorId}/resume`, undefined);
    return res.monitor;
  }

  async listChecks(monitorId: string, params: ListMonitorChecksParams = {}): Promise<ListMonitorChecksResponse> {
    const q = new URLSearchParams();
    if (params.page != null) q.set("page", String(params.page));
    if (params.limit != null) q.set("limit", String(params.limit));
    const qs = q.toString();
    const { checks, total, page } = await this.http.get<ListMonitorChecksResponse>(
      `/monitors/${monitorId}/checks${qs ? `?${qs}` : ""}`
    );
    return { checks, total, page };
  }

  async getCheck(monitorId: string, checkId: string): Promise<MonitorCheck> {
    const res = await this.http.get<{ check: MonitorCheck }>(`/monitors/${monitorId}/checks/${checkId}`);
    return res.check;
  }
}
