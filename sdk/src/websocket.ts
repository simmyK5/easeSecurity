import { WebSocketImpl } from "./utils";
import type { StreamChunk } from "./types";

export class EaseWebSocket {
  private ws?: WebSocket;
  private wsConnected = false;
  private wsUrl: string;

  constructor(wsUrl: string) {
    this.wsUrl = wsUrl;
  }

  connect(onOpen?: () => void, onError?: (err: any) => void, onClose?: () => void) {
    if (this.ws && this.wsConnected) return;
    this.ws = new WebSocketImpl(this.wsUrl);

    this.ws.onopen = () => {
      this.wsConnected = true;
      onOpen?.();
    };
    this.ws.onerror = (err) => onError?.(err);
    this.ws.onclose = () => {
      this.wsConnected = false;
      onClose?.();
    };
  }

  sendChunk(chunk: StreamChunk) {
    if (!this.ws || !this.wsConnected) {
      throw new Error("WebSocket not connected — call connect() first");
    }
    this.ws.send(JSON.stringify({ type: "audio_chunk", data: chunk }));
  }

  close() {
    if (this.ws) this.ws.close();
    this.ws = undefined;
    this.wsConnected = false;
  }
}
