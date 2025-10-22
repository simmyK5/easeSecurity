// ease-sdk/src/EaseSDKCore.js
import { io } from "socket.io-client";

export default class EaseSDKCore {
  constructor({ apiKey, baseUrl, wsUrl, debug = false }) {
    if (!apiKey) throw new Error("API key required");
    if (!baseUrl) throw new Error("baseUrl required");

    this.apiKey = apiKey;
    this.baseUrl = baseUrl.replace(/\/$/, "");
    this.wsUrl = wsUrl || this.baseUrl.replace(/^http/, "ws");
    this.debug = debug;

    this.socket = null;
    this.streamId = null;
    this.connected = false;
  }

  log(...args) {
    if (this.debug) console.log("[EaseSDK]", ...args);
  }

  // ---------- INCIDENT UPLOAD ----------
  async reportIncident({ location, audioData, metadata }) {
    const payload = {
      location,
      metadata,
      audioDataBase64: audioData,
      timestamp: new Date().toISOString(),
    };

    const res = await fetch(`${this.baseUrl}/api/sdk/incidents`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": this.apiKey,
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) throw new Error(`SDK Error: ${res.statusText}`);
    return await res.json();
  }

  // ---------- LIVE STREAM ----------
  connectStream(streamId) {
    return new Promise((resolve, reject) => {
      try {
        this.streamId = streamId;
        this.socket = io(`${this.wsUrl}/sdk`, {
          transports: ["websocket"],
          query: { apiKey: this.apiKey, streamId },
        });

        this.socket.on("connect", () => {
          this.connected = true;
          this.log("Connected to SDK socket");
          resolve(true);
        });

        this.socket.on("disconnect", () => {
          this.connected = false;
          this.log("Disconnected from SDK socket");
        });

        this.socket.on("error", (err) => {
          this.log("Socket error:", err);
          reject(err);
        });
      } catch (err) {
        reject(err);
      }
    });
  }

  sendAudioChunk({ audioBase64, seq, final = false, metadata }) {
    if (!this.connected) throw new Error("Socket not connected");
    this.socket.emit("audio_chunk", { audioBase64, seq, final, metadata });
  }

  async endStream() {
    if (this.socket) {
      this.socket.disconnect();
      this.connected = false;
    }
  }
}
