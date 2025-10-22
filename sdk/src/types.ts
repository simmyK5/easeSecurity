export type IncidentPayload = {
  userEmail: string;
  audioDataBase64?: string | null;
  timestamp?: string;
  metadata?: Record<string, any>;
};

export type StreamChunk = {
  audioBase64: string;
  seq?: number;
  final?: boolean;
};

export type EaseClientOptions = {
  baseUrl: string;  // Backend base URL (e.g. https://api.easeprotect.com)
  apiKey: string;   // Developer’s API key
  timeoutMs?: number;
  wsUrl?: string;
};
