import type { HttpClient } from "../lib/http.js";
import type {
  CreatePresetParams,
  ListPresetsParams,
  ListPresetsResponse,
  Preset,
  RunPresetParams,
  RunPresetResponse,
  UpdatePresetParams,
} from "../types/presets.js";

export class PresetsResource {
  constructor(private http: HttpClient) {}

  async list(params: ListPresetsParams = {}): Promise<ListPresetsResponse> {
    const q = new URLSearchParams();
    if (params.page != null) q.set("page", String(params.page));
    if (params.limit != null) q.set("limit", String(params.limit));
    const qs = q.toString();
    const res = await this.http.get<{ data: ListPresetsResponse }>(`/presets${qs ? `?${qs}` : ""}`);
    return res.data;
  }

  async create(params: CreatePresetParams): Promise<{ id: string }> {
    const res = await this.http.post<{ data: { id: string; uuid: string } }>("/presets", params);
    return { id: res.data.id };
  }

  async get(presetId: string): Promise<Preset> {
    const res = await this.http.get<{ data: Preset }>(`/presets/${presetId}`);
    return res.data;
  }

  async update(presetId: string, params: UpdatePresetParams): Promise<void> {
    await this.http.patch(`/presets/${presetId}`, params);
  }

  async delete(presetId: string): Promise<void> {
    await this.http.delete(`/presets/${presetId}`);
  }

  async run(presetId: string, params: RunPresetParams = {}): Promise<RunPresetResponse> {
    const { status: _status, ...rest } = await this.http.post<RunPresetResponse & { status: string }>(
      `/presets/${presetId}/runs`,
      params
    );
    return rest as RunPresetResponse;
  }
}
