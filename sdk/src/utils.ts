let fetchFn: typeof fetch;
let WebSocketImpl: typeof WebSocket;

if (typeof window !== "undefined" && window.fetch && window.WebSocket) {
  // Browser
  fetchFn = window.fetch.bind(window);
  WebSocketImpl = window.WebSocket;
} else {
  // Node.js
  fetchFn = require("node-fetch");
  WebSocketImpl = require("isomorphic-ws");
}

export { fetchFn, WebSocketImpl };
