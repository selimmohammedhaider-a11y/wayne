// WayneOS Telemetry — Flow Activity Chart & Session Tracking (FR-4.2 / FR-4.3)
import { storage } from "./storage.js";

const THRESHOLD_HOURS = 4.0;

export class TelemetryEngine {
  constructor({ onUpdate }) {
    this.onUpdate = onUpdate;
    this.sessions = storage.get("telemetry:sessions", []);
    this.webhookUrl = storage.get("telemetry:webhook", "");
  }

  // Record a completed focus session
  recordSession({ type, preset, duration }) {
    const session = {
      id:        `s_${Date.now()}`,
      type,
      preset,
      durationSec: duration,
      date:        new Date().toISOString().split("T")[0],
      timestamp:   Date.now(),
    };
    this.sessions.push(session);
    this._persist();
    this.onUpdate(this.getWeeklyData());
  }

  // Get 7-day aggregated focus hours
  getWeeklyData() {
    const days    = [];
    const labels  = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
    const today   = new Date();

    for (let i = 6; i >= 0; i--) {
      const d     = new Date(today);
      d.setDate(d.getDate() - i);
      const key   = d.toISOString().split("T")[0];
      const day   = labels[d.getDay()];
      const secs  = this.sessions
        .filter(s => s.date === key && s.type === "focus")
        .reduce((sum, s) => sum + s.durationSec, 0);

      days.push({
        date:          key,
        day,
        hours:         +(secs / 3600).toFixed(2),
        isToday:       i === 0,
        thresholdMet:  secs / 3600 >= THRESHOLD_HOURS,
      });
    }

    return days;
  }

  getTodayHours() {
    const today = new Date().toISOString().split("T")[0];
    const secs  = this.sessions
      .filter(s => s.date === today && s.type === "focus")
      .reduce((sum, s) => sum + s.durationSec, 0);
    return +(secs / 3600).toFixed(2);
  }

  getTotalSessions() {
    return this.sessions.filter(s => s.type === "focus").length;
  }

  // ── Export ──────────────────────────────────────────────
  exportJSON() {
    const data = JSON.stringify({ sessions: this.sessions }, null, 2);
    this._download("wayneos-sessions.json", data, "application/json");
  }

  exportCSV() {
    const header = "id,type,preset,durationSec,date,timestamp\n";
    const rows   = this.sessions.map(s =>
      `${s.id},${s.type},${s.preset},${s.durationSec},${s.date},${s.timestamp}`
    ).join("\n");
    this._download("wayneos-sessions.csv", header + rows, "text/csv");
  }

  async webhookExport() {
    if (!this.webhookUrl) return { error: "No webhook URL set" };
    try {
      const res = await fetch("http://localhost:3001/api/telemetry/export", {
        method:  "POST",
        headers: { "Content-Type": "application/json" },
        body:    JSON.stringify({ sessions: this.sessions, webhookUrl: this.webhookUrl }),
      });
      return await res.json();
    } catch (e) {
      return { error: e.message };
    }
  }

  setWebhook(url) {
    this.webhookUrl = url;
    storage.set("telemetry:webhook", url);
  }

  _download(filename, content, mime) {
    const blob = new Blob([content], { type: mime });
    const url  = URL.createObjectURL(blob);
    const a    = Object.assign(document.createElement("a"), { href: url, download: filename });
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  _persist() {
    storage.set("telemetry:sessions", this.sessions);
  }

  get THRESHOLD() { return THRESHOLD_HOURS; }
}
