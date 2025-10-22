// ease-sdk/src/index.js
import EaseSDKCore from "./EaseSDKCore.js";

// Detect runtime
const isBrowser =
  typeof window !== "undefined" && typeof window.document !== "undefined";
const isReactNative =
  typeof navigator !== "undefined" && navigator.product === "ReactNative";
const isNode = !isBrowser && !isReactNative;

export default class EaseSDK extends EaseSDKCore {
  constructor(config) {
    super(config);
    if (isReactNative) {
      console.log("[EaseSDK] Running in React Native mode");
    } else if (isBrowser) {
      console.log("[EaseSDK] Running in Browser mode");
    } else if (isNode) {
      console.log("[EaseSDK] Running in Node mode");
    }
  }
}



/*const io = require('socket.io-client');
const fetch = require('node-fetch');

class EaseClient {
  constructor({ baseUrl, apiKey, timeoutMs = 15000, wsUrl } = {}) {
    if (!baseUrl || !apiKey) throw new Error('baseUrl and apiKey required');
    this.baseUrl = baseUrl.replace(/\/$/, '');
    this.apiKey = apiKey;
    this.timeoutMs = timeoutMs;
    this.wsUrl = wsUrl;
    this.socket = null;
    this.wsConnected = false;
  }

  async reportIncident(payload) {
    const controller = new AbortController();
    const id = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      const res = await fetch(`${this.baseUrl}/api/sdk/incidents`, {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-api-key': this.apiKey
        },
        body: JSON.stringify(payload),
        signal: controller.signal
      });
      clearTimeout(id);
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`HTTP ${res.status}: ${text}`);
      }
      return await res.json();
    } finally {
      clearTimeout(id);
    }
  }

  startAudioStream(opts = {}) {
    if (this.socket && this.wsConnected) return;
    const base = this.wsUrl || this.baseUrl.replace(/^http/, 'ws');
    const url = `${base.replace(/\/$/, '')}/sdk`;
    this.socket = io(url, {
      query: { apiKey: this.apiKey, streamId: opts.streamId || undefined },
      transports: ['websocket'],
      autoConnect: true
    });
    this.socket.on('connect', () => {
      this.wsConnected = true;
    });
    this.socket.on('disconnect', () => {
      this.wsConnected = false;
    });
    this.socket.on('error', (e) => console.error('EaseClient socket error', e));
  }

  sendAudioChunk(chunk) {
    if (!this.socket || !this.wsConnected) throw new Error('Socket not connected');
    this.socket.emit('audio_chunk', chunk);
  }

  async stopAudioStream() {
    if (!this.socket) return;
    this.socket.disconnect();
    this.socket = null;
    this.wsConnected = false;
  }
}

module.exports = EaseClient;
*/