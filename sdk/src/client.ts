import { fetchFn } from "./utils";
import { EaseWebSocket } from "./websocket";
import type { EaseClientOptions, IncidentPayload, StreamChunk } from "./types";

export class EaseClient {
  private baseUrl: string;
  private apiKey: string;
  private timeoutMs: number;
  private wsUrl?: string;
  private ws?: EaseWebSocket;

  constructor(opts: EaseClientOptions) {
    if (!opts?.baseUrl || !opts?.apiKey) {
      throw new Error("EaseClient requires baseUrl and apiKey");
    }
    this.baseUrl = opts.baseUrl.replace(/\/$/, "");
    this.apiKey = opts.apiKey;
    this.timeoutMs = opts.timeoutMs ?? 15000;
    this.wsUrl = opts.wsUrl;
  }

  // REST API helper
  private async fetchJson<T = any>(path: string, init: RequestInit) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const res = await fetchFn(`${this.baseUrl}${path}`, {
        ...init,
        headers: {
          ...(init.headers ?? {}),
          "x-api-key": this.apiKey,
          "content-type": "application/json",
        },
        signal: controller.signal as any,
      });
      clearTimeout(id);
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(`HTTP ${res.status}: ${txt}`);
      }
      return (await res.json()) as T;
    } finally {
      clearTimeout(id);
    }
  }

  // Report single incident
  async reportIncident(payload: IncidentPayload) {
    const res = await this.fetchJson("/api/sdk/incidents", {
      method: "POST",
      body: JSON.stringify({
        ...payload,
        timestamp: payload.timestamp ?? new Date().toISOString(),
      }),
    });
    return res;
  }

  // Start live audio stream
  async startAudioStream() {
    if (this.ws) return;
    const wsUrl = this.wsUrl ?? this.baseUrl.replace(/^http/, "ws");
    const connectUrl = `${wsUrl}/sdk?apiKey=${encodeURIComponent(this.apiKey)}`;
    this.ws = new EaseWebSocket(connectUrl);
    this.ws.connect();
  }

  // Send a chunk of audio
  sendAudioChunk(chunk: StreamChunk) {
    if (!this.ws) throw new Error("WebSocket not connected — call startAudioStream()");
    this.ws.sendChunk(chunk);
  }

  // Stop the stream
  stopAudioStream() {
    this.ws?.close();
    this.ws = undefined;
  }

  // Check quota
  async getQuota() {
    return await this.fetchJson("/api/sdk/quota", { method: "GET" });
  }
}
