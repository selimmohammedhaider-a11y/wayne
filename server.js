import express from "express";
import cors from "cors";
import { GoogleGenAI } from "@google/genai";
import { createRequire } from "module";
import { readFileSync } from "fs";

// Load .env manually (dotenv ESM compat)
try {
  const require = createRequire(import.meta.url);
  const { config } = require("dotenv");
  config();
} catch {}

const app = express();
const PORT = process.env.PORT || 3001;

// ─── CORS ──────────────────────────────────────────────────────────────────
app.use(cors({
  origin: ["http://localhost:5500", "http://127.0.0.1:5500", "null"],
  methods: ["GET", "POST", "OPTIONS"],
  allowedHeaders: ["Content-Type"],
}));
app.use(express.json({ limit: "2mb" }));

// ─── Gemini Client ─────────────────────────────────────────────────────────
const genai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// Mode system prompts
const MODE_PROMPTS = {
  code: `You are Vance, an elite code synthesis AI inside WayneOS Midnight Focus Studio.
You help engineers write, debug, and review code at speed. 
Rules: Be laser-precise. Lead with code blocks. Minimal prose. Use syntax highlighting.
Max response: 400 tokens unless the user explicitly asks for more.`,

  concept: `You are Vance, a concept breakdown expert inside WayneOS Midnight Focus Studio.
You excel at distilling complex topics into clear, structured mental models.
Rules: Use numbered steps or bullet points. Analogies welcome. Avoid jargon unless asked.
Max response: 350 tokens.`,

  sprint: `You are Vance, a sprint summarizer inside WayneOS Midnight Focus Studio.
You help engineers reflect on what they just accomplished, identify blockers, and plan next actions.
Rules: Output: (1) DONE, (2) BLOCKERS, (3) NEXT 3 ACTIONS. Terse and actionable.
Max response: 300 tokens.`,
};

// ─── Health check ──────────────────────────────────────────────────────────
app.get("/health", (_req, res) => {
  res.json({ status: "ok", service: "WayneOS Vance AI Gateway", model: "gemini-3.8-flash" });
});

// ─── Vance AI — Streaming endpoint ────────────────────────────────────────
app.post("/api/vance/stream", async (req, res) => {
  const { message, mode = "code", history = [] } = req.body;

  if (!message || typeof message !== "string" || message.trim().length === 0) {
    return res.status(400).json({ error: "message is required" });
  }

  const systemInstruction = MODE_PROMPTS[mode] || MODE_PROMPTS.code;

  // Build conversation input
  const conversationTurns = history.map(h => ({
    role: h.role,
    parts: [{ text: h.text }],
  }));

  // SSE headers
  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders();

  const send = (data) => res.write(`data: ${JSON.stringify(data)}\n\n`);

  try {
    // Build previous interaction ID chain if history provided
    let previousInteractionId = req.body.previousInteractionId || null;

    const streamEvents = await genai.interactions.create({
      model: "gemini-3.8-flash",
      input: message,
      system_instruction: systemInstruction,
      ...(previousInteractionId ? { previous_interaction_id: previousInteractionId } : {}),
      stream: true,
      store: true,
    });

    let interactionId = null;

    for await (const event of streamEvents) {
      if (event.event_type === "interaction.created") {
        interactionId = event.interaction?.id;
        send({ type: "start", interactionId });
      } else if (event.event_type === "step.delta") {
        if (event.delta?.type === "text") {
          send({ type: "token", text: event.delta.text });
        }
      } else if (event.event_type === "interaction.completed") {
        send({
          type: "done",
          interactionId: event.interaction?.id || interactionId,
          usage: event.interaction?.usage,
        });
      }
    }

    res.write("data: [DONE]\n\n");
    res.end();
  } catch (err) {
    console.error("[Vance] Streaming error:", err.message);
    send({ type: "error", message: err.message });
    res.write("data: [DONE]\n\n");
    res.end();
  }
});

// ─── Session telemetry webhook export ─────────────────────────────────────
app.post("/api/telemetry/export", async (req, res) => {
  const { sessions, webhookUrl } = req.body;

  if (!sessions || !Array.isArray(sessions)) {
    return res.status(400).json({ error: "sessions array required" });
  }

  const payload = {
    source: "WayneOS",
    exportedAt: new Date().toISOString(),
    sessions,
  };

  // If a Google Sheets webhook URL is provided, forward to it
  if (webhookUrl && typeof webhookUrl === "string") {
    try {
      const r = await fetch(webhookUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      return res.json({ success: true, webhookStatus: r.status });
    } catch (err) {
      return res.status(502).json({ error: "Webhook failed", detail: err.message });
    }
  }

  res.json({ success: true, data: payload });
});

// ─── Start server ──────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🌃 WayneOS Vance AI Gateway running → http://localhost:${PORT}`);
  console.log(`   Model: gemini-3.8-flash (streaming)`);
  console.log(`   Health: http://localhost:${PORT}/health\n`);
});
