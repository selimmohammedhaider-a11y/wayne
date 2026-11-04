// WayneOS Vance AI — Gemini 3.8 Flash streaming (FR-3.x)

const API_BASE = "http://localhost:3001";

export const VANCE_MODES = ["code", "concept", "sprint"];

export class VanceAI {
  constructor({ onToken, onStart, onDone, onError, onDuck }) {
    this.onToken  = onToken;
    this.onStart  = onStart;
    this.onDone   = onDone;
    this.onError  = onError;
    this.onDuck   = onDuck;  // audio duck callback

    this.mode                = "code";
    this.previousInteractionId = null;
    this.isStreaming          = false;
    this._abortCtrl           = null;
  }

  setMode(mode) {
    if (VANCE_MODES.includes(mode)) this.mode = mode;
  }

  async send(message) {
    if (this.isStreaming) {
      this._abortCtrl?.abort();
    }

    this.isStreaming = true;
    this._abortCtrl  = new AbortController();

    // Auto-duck audio during Vance response
    this.onDuck?.(true);
    this.onStart?.();

    try {
      const res = await fetch(`${API_BASE}/api/vance/stream`, {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({
          message,
          mode: this.mode,
          previousInteractionId: this.previousInteractionId,
        }),
        signal: this._abortCtrl.signal,
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Network error" }));
        throw new Error(err.error || `HTTP ${res.status}`);
      }

      const reader  = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer    = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer      = lines.pop(); // keep incomplete line

        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          const payload = line.slice(6).trim();
          if (payload === "[DONE]") break;

          try {
            const event = JSON.parse(payload);
            if (event.type === "token") {
              this.onToken?.(event.text);
            } else if (event.type === "done") {
              this.previousInteractionId = event.interactionId;
            } else if (event.type === "error") {
              throw new Error(event.message);
            }
          } catch (parseErr) {
            // Skip malformed SSE lines
          }
        }
      }

      this.onDone?.();
    } catch (err) {
      if (err.name === "AbortError") return;
      this.onError?.(err.message);
    } finally {
      this.isStreaming = false;
      // Un-duck audio after response
      setTimeout(() => this.onDuck?.(false), 400);
    }
  }

  abort() {
    this._abortCtrl?.abort();
    this.isStreaming = false;
    this.onDuck?.(false);
  }

  resetConversation() {
    this.previousInteractionId = null;
  }
}
