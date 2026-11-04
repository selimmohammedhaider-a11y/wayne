// WayneOS Pomodoro — Precision Focus Engine (FR-1.x)
// Uses Date.now() delta calculation to prevent throttling skew (FR-1.3)

import { storage } from "./storage.js";

export const CYCLE_PRESETS = {
  "Deep Sprint":  { focus: 50 * 60, breakDur: 10 * 60, label: "50/10" },
  "Standard":     { focus: 25 * 60, breakDur:  5 * 60, label: "25/5"  },
  "Ultradian":    { focus: 90 * 60, breakDur: 20 * 60, label: "90/20" },
};

export class PomodoroEngine {
  constructor({ onTick, onStateChange, onSessionEnd }) {
    this.onTick        = onTick;
    this.onStateChange = onStateChange;
    this.onSessionEnd  = onSessionEnd;

    // State
    this.state        = "idle";   // idle | focus | break | paused
    this.presetKey    = storage.get("pomo:preset", "Standard");
    this.remaining    = CYCLE_PRESETS[this.presetKey].focus;
    this.startAt      = null;
    this.pausedAt     = null;
    this.sessionsDone = storage.get("pomo:sessions", 0);
    this._raf         = null;
  }

  get preset() { return CYCLE_PRESETS[this.presetKey]; }

  get isRunning() { return this.state === "focus" || this.state === "break"; }

  // ── Core tick (rAF-based, skew-corrected) ────────────────────────────
  _tick() {
    if (!this.isRunning) return;

    const now     = Date.now();
    const elapsed = (now - this.startAt) / 1000;
    const total   = this.state === "focus" ? this.preset.focus : this.preset.breakDur;
    const left    = Math.max(0, total - elapsed);

    this.remaining = left;
    this.onTick(left, total, this.state);

    if (left <= 0) {
      this._complete();
      return;
    }

    this._raf = requestAnimationFrame(() => this._tick());
  }

  _complete() {
    if (this.state === "focus") {
      this.sessionsDone++;
      storage.set("pomo:sessions", this.sessionsDone);
      this.onSessionEnd({ type: "focus", preset: this.presetKey, duration: this.preset.focus });
      this._transition("break");
    } else {
      this._transition("idle");
    }
    this.onStateChange(this.state);
  }

  _transition(newState) {
    this.state = newState;
    if (newState === "focus" || newState === "break") {
      this.startAt = Date.now();
      this.remaining = newState === "focus" ? this.preset.focus : this.preset.breakDur;
      this._raf = requestAnimationFrame(() => this._tick());
    }
    this.onStateChange(this.state);
  }

  // ── Public API ───────────────────────────────────────────────────────
  start() {
    if (this.state === "paused") {
      // Resume: shift startAt to account for paused time
      this.startAt = Date.now() - (this.preset.focus - this.remaining) * 1000;
      this.state = "focus";
    } else if (this.state === "idle") {
      this._transition("focus");
      return;
    }
    this.onStateChange(this.state);
    this._raf = requestAnimationFrame(() => this._tick());
  }

  pause() {
    if (!this.isRunning) return;
    cancelAnimationFrame(this._raf);
    this.pausedAt = Date.now();
    this.state = "paused";
    this.onStateChange("paused");
  }

  toggle() {
    if (this.isRunning) this.pause();
    else this.start();
  }

  reset() {
    cancelAnimationFrame(this._raf);
    this.state     = "idle";
    this.remaining = this.preset.focus;
    this.startAt   = null;
    this.onTick(this.remaining, this.preset.focus, "idle");
    this.onStateChange("idle");
  }

  takeBreak() {
    if (!this.isRunning) return;
    cancelAnimationFrame(this._raf);
    this._transition("break");
  }

  extendFive() {
    if (this.state !== "focus") return;
    // Shift startAt back by 5 minutes to add time
    this.startAt -= 5 * 60 * 1000;
  }

  setPreset(key) {
    if (!CYCLE_PRESETS[key]) return;
    cancelAnimationFrame(this._raf);
    this.presetKey = key;
    storage.set("pomo:preset", key);
    this.state     = "idle";
    this.remaining = this.preset.focus;
    this.onTick(this.remaining, this.preset.focus, "idle");
    this.onStateChange("idle");
  }

  getProgress(remaining, total) {
    return 1 - (remaining / total);
  }

  formatTime(seconds) {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }
}
