// WayneOS app.js — Main orchestrator
import { PomodoroEngine, CYCLE_PRESETS } from "./pomodoro.js";
import { SoundscapeMixer, STEMS, SCENE_PRESETS } from "./audio.js";
import { VanceAI, VANCE_MODES } from "./vance.js";
import { TaskQueue } from "./tasks.js";
import { TelemetryEngine } from "./telemetry.js";
import { storage } from "./storage.js";

// ══════════════════════════════════════════════════════════════
// DOM helpers
// ══════════════════════════════════════════════════════════════
const $ = (sel, ctx = document) => ctx.querySelector(sel);
const $$ = (sel, ctx = document) => [...ctx.querySelectorAll(sel)];

function toast(msg, type = "info") {
  const c   = $("#toast-container");
  const el  = document.createElement("div");
  el.className = "toast";
  el.textContent = msg;
  if (type === "success") el.style.borderColor = "rgba(52,199,89,0.3)";
  if (type === "error")   el.style.borderColor = "rgba(255,69,58,0.3)";
  c.appendChild(el);
  setTimeout(() => el.remove(), 4000);
}

// ══════════════════════════════════════════════════════════════
// Pomodoro UI
// ══════════════════════════════════════════════════════════════
function initPomodoro(mixer, telemetry) {
  const circumference = 2 * Math.PI * 90; // r=90
  const ring          = $("#ring-progress");
  const timeEl        = $("#timer-display");
  const stateEl       = $("#timer-state");
  const playBtn       = $("#play-btn");
  const playIcon      = $("#play-icon");

  ring.style.strokeDasharray  = circumference;
  ring.style.strokeDashoffset = 0;

  const engine = new PomodoroEngine({
    onTick(remaining, total, state) {
      const progress = 1 - remaining / total;
      const offset   = circumference * (1 - progress);
      ring.style.strokeDashoffset = offset;
      timeEl.textContent = engine.formatTime(remaining);

      // Swap break ring color
      if (state === "break") {
        ring.classList.add("break-mode");
      } else {
        ring.classList.remove("break-mode");
      }

      // Update tab title
      document.title = `${engine.formatTime(remaining)} · WayneOS`;
    },

    onStateChange(state) {
      const labels = { idle: "READY", focus: "DEEP FOCUS", break: "BREAK", paused: "PAUSED" };
      stateEl.textContent = labels[state] || state.toUpperCase();
      playIcon.textContent = (state === "focus" || state === "break") ? "⏸" : "▶";

      // Session dots
      renderSessionDots(engine.sessionsDone);

      // Audio fade on session end
      if (state === "break") mixer.fadeOutOnSessionEnd?.();
    },

    onSessionEnd(data) {
      telemetry.recordSession(data);
      toast(`✅ Focus sprint done! ${Math.round(data.duration / 60)} min`, "success");
    },
  });

  // Play / Pause
  playBtn.addEventListener("click", () => engine.toggle());

  // Spacebar shortcut (FR-1.4)
  document.addEventListener("keydown", (e) => {
    if (e.code === "Space" && !isInputFocused()) {
      e.preventDefault();
      engine.toggle();
    }
  });

  // Quick actions
  $("#btn-plus5").addEventListener("click", () => {
    engine.extendFive();
    toast("+5 minutes added");
  });
  $("#btn-break").addEventListener("click", () => {
    engine.takeBreak();
    toast("Taking a break 🧘");
  });
  $("#btn-reset").addEventListener("click", () => {
    engine.reset();
    document.title = "WayneOS // Midnight Focus";
  });

  // Preset chips
  $$(".preset-chip").forEach(chip => {
    const key = chip.dataset.preset;
    if (engine.presetKey === key) chip.classList.add("active");
    chip.addEventListener("click", () => {
      $$(".preset-chip").forEach(c => c.classList.remove("active"));
      chip.classList.add("active");
      engine.setPreset(key);
      const p = CYCLE_PRESETS[key];
      timeEl.textContent = engine.formatTime(p.focus);
    });
  });

  renderSessionDots(engine.sessionsDone);
  timeEl.textContent = engine.formatTime(engine.remaining);
  return engine;
}

function renderSessionDots(count) {
  const wrap = $("#session-dots");
  wrap.innerHTML = "";
  for (let i = 0; i < 4; i++) {
    const dot = document.createElement("div");
    dot.className = "session-dot" + (i < count % 4 ? " done" : "");
    wrap.appendChild(dot);
  }
}

// ══════════════════════════════════════════════════════════════
// Audio Mixer UI
// ══════════════════════════════════════════════════════════════
function initAudio() {
  const mixer = new SoundscapeMixer();
  const grid  = $("#stem-grid");
  const stemVols = {};

  // Build stem rows
  STEMS.forEach(stem => {
    stemVols[stem.id] = stem.defaultVol;

    const row = document.createElement("div");
    row.className = "stem-row";
    row.innerHTML = `
      <div class="stem-icon">${stem.icon}</div>
      <div class="stem-label-wrap">
        <div class="stem-name">${stem.name}</div>
        <div class="stem-desc">${stem.desc}</div>
      </div>
      <div>
        <input type="range" class="stem-slider" data-stem="${stem.id}"
          min="0" max="1" step="0.01" value="${stem.defaultVol}">
        <div class="stem-vol-label" id="vol-${stem.id}">${Math.round(stem.defaultVol * 100)}%</div>
      </div>
      <button class="stem-toggle-btn active" data-stem-toggle="${stem.id}" title="Toggle">🔊</button>
    `;
    grid.appendChild(row);

    // Slider
    row.querySelector(".stem-slider").addEventListener("input", (e) => {
      const vol = parseFloat(e.target.value);
      stemVols[stem.id] = vol;
      document.getElementById(`vol-${stem.id}`).textContent = `${Math.round(vol * 100)}%`;
      mixer.setStemVolume(stem.id, vol);
    });

    // Toggle mute
    row.querySelector(".stem-toggle-btn").addEventListener("click", (e) => {
      const btn    = e.currentTarget;
      const active = btn.classList.toggle("active");
      mixer.setStemVolume(stem.id, active ? stemVols[stem.id] : 0);
      btn.textContent = active ? "🔊" : "🔇";
    });
  });

  // Master volume
  const masterSlider = $("#master-slider");
  masterSlider.addEventListener("input", (e) => {
    const vol = parseFloat(e.target.value);
    document.getElementById("master-vol-label").textContent = `${Math.round(vol * 100)}%`;
    mixer.setMasterVolume(vol);
  });

  // Power toggle
  const powerBtn = $("#audio-power-btn");
  let audioOn = false;
  powerBtn.addEventListener("click", () => {
    audioOn = !audioOn;
    powerBtn.classList.toggle("active", audioOn);
    powerBtn.textContent = audioOn ? "⏹ Stop" : "▶ Play";
    if (audioOn) mixer.startAll();
    else         mixer.stopAll();
  });

  // Preset buttons
  $$(".scene-preset-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      const preset = btn.dataset.preset;
      if (!audioOn) {
        audioOn = true;
        $("#audio-power-btn").classList.add("active");
        $("#audio-power-btn").textContent = "⏹ Stop";
        mixer.startAll();
      }
      const vals = mixer.loadPreset(preset);
      if (vals) {
        // Sync slider UIs
        Object.entries(vals).forEach(([id, vol]) => {
          if (id === "master") {
            masterSlider.value = vol;
            document.getElementById("master-vol-label").textContent = `${Math.round(vol * 100)}%`;
          } else {
            const slider = document.querySelector(`input[data-stem="${id}"]`);
            if (slider) {
              slider.value = vol;
              const lbl = document.getElementById(`vol-${id}`);
              if (lbl) lbl.textContent = `${Math.round(vol * 100)}%`;
            }
          }
        });
        toast(`🎚️ Scene: ${preset}`);
      }
    });
  });

  return mixer;
}

// ══════════════════════════════════════════════════════════════
// Task Queue UI
// ══════════════════════════════════════════════════════════════
function initTasks() {
  const listEl    = $("#task-list");
  const addInput  = $("#task-add-input");
  const countBadge = $("#task-count-badge");

  const queue = new TaskQueue({
    onUpdate(tasks) {
      renderTasks(tasks);
    },
  });

  function renderTasks(tasks) {
    listEl.innerHTML = "";
    tasks.forEach(task => {
      const item = document.createElement("div");
      item.className = "task-item" + (task.done ? " done" : "");
      item.innerHTML = `
        <div class="task-check${task.done ? " checked" : ""}" data-id="${task.id}">
          ${task.done ? "✓" : ""}
        </div>
        <div class="task-name" contenteditable="false" data-id="${task.id}">${escHtml(task.text)}</div>
        <button class="task-delete-btn btn" data-delete="${task.id}" title="Remove">✕</button>
      `;
      listEl.appendChild(item);

      // Toggle done
      item.querySelector(".task-check").addEventListener("click", () => queue.toggle(task.id));

      // Delete
      item.querySelector(".task-delete-btn").addEventListener("click", () => queue.remove(task.id));

      // Double-click to edit
      const nameEl = item.querySelector(".task-name");
      nameEl.addEventListener("dblclick", () => {
        nameEl.contentEditable = "true";
        nameEl.focus();
        // Select all
        const range = document.createRange();
        range.selectNodeContents(nameEl);
        window.getSelection().removeAllRanges();
        window.getSelection().addRange(range);
      });
      nameEl.addEventListener("blur", () => {
        nameEl.contentEditable = "false";
        queue.updateText(task.id, nameEl.textContent);
      });
      nameEl.addEventListener("keydown", e => {
        if (e.key === "Enter") { e.preventDefault(); nameEl.blur(); }
        if (e.key === "Escape") { nameEl.textContent = task.text; nameEl.blur(); }
      });
    });

    // Update badge
    const active  = queue.activeCount;
    const atLimit = active >= queue.MAX;
    countBadge.textContent  = `${active}/${queue.MAX}`;
    countBadge.className    = "task-limit-badge" + (atLimit ? " at-limit" : "");
    addInput.disabled       = atLimit;
    addInput.placeholder    = atLimit
      ? "Complete a task to add more (max 3)"
      : "Add a focus task… (Enter)";
  }

  // Add task
  addInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && addInput.value.trim()) {
      const added = queue.add(addInput.value);
      if (added) addInput.value = "";
      else toast("⚠️ 3-task limit reached — complete one first", "error");
    }
  });

  // Clear done
  $("#clear-done-btn").addEventListener("click", () => {
    queue.clearDone();
    toast("Done tasks cleared");
  });

  renderTasks(queue.tasks);
  return queue;
}

// ══════════════════════════════════════════════════════════════
// Telemetry / Flow Chart UI
// ══════════════════════════════════════════════════════════════
function initTelemetry() {
  const engine = new TelemetryEngine({
    onUpdate(weeklyData) {
      renderChart(weeklyData);
    },
  });

  function renderChart(weeklyData) {
    const wrap      = $("#chart-wrap");
    const maxHours  = Math.max(engine.THRESHOLD + 1, ...weeklyData.map(d => d.hours));

    wrap.innerHTML = "";
    weeklyData.forEach(day => {
      const pct    = maxHours > 0 ? (day.hours / maxHours) * 100 : 0;
      const barWrap = document.createElement("div");
      barWrap.className = "chart-bar-wrap";
      barWrap.innerHTML = `
        <div class="chart-bar${day.isToday ? " today" : ""}${day.thresholdMet ? " threshold-met" : ""}"
             style="height: ${Math.max(pct, 2)}%">
          <div class="bar-tooltip">${day.hours}h</div>
        </div>
        <div class="chart-day-label">${day.isToday ? "Now" : day.day}</div>
      `;
      wrap.appendChild(barWrap);
    });

    // Stats
    const todayH = engine.getTodayHours();
    document.getElementById("stat-today").textContent = `${todayH}h`;
    document.getElementById("stat-sessions").textContent = engine.getTotalSessions();
  }

  renderChart(engine.getWeeklyData());

  // Export buttons
  $("#export-json-btn").addEventListener("click", () => { engine.exportJSON(); toast("JSON exported ↓"); });
  $("#export-csv-btn").addEventListener("click",  () => { engine.exportCSV();  toast("CSV exported ↓"); });
  $("#export-webhook-btn").addEventListener("click", async () => {
    const result = await engine.webhookExport();
    if (result.error) toast(`❌ ${result.error}`, "error");
    else              toast("✅ Synced to Google Sheets", "success");
  });

  // Webhook URL input
  const whInput = $("#webhook-url-input");
  whInput.value = storage.get("telemetry:webhook", "");
  whInput.addEventListener("change", () => engine.setWebhook(whInput.value.trim()));

  return engine;
}

// ══════════════════════════════════════════════════════════════
// Vance AI UI
// ══════════════════════════════════════════════════════════════
function initVance(mixer) {
  const drawer    = $("#vance-drawer");
  const backdrop  = $("#vance-backdrop");
  const fab       = $("#vance-fab");
  const closeBtn  = $("#vance-close-btn");
  const textarea  = $("#vance-textarea");
  const sendBtn   = $("#vance-send-btn");
  const msgList   = $("#vance-messages");
  const modeBtns  = $$(".vance-mode-btn");
  const statusDot = $("#vance-status-dot");

  let currentMode = "code";
  let fullResponse = "";

  const vance = new VanceAI({
    onDuck: (enable) => mixer.duck(enable),

    onStart() {
      sendBtn.disabled    = true;
      statusDot.className = "status-dot busy";
      // Append typing indicator
      const typing = document.createElement("div");
      typing.id    = "typing-indicator";
      typing.className = "msg assistant";
      typing.innerHTML = `
        <div class="msg-bubble glass-sm">
          <div class="typing-indicator">
            <div class="typing-dot"></div>
            <div class="typing-dot"></div>
            <div class="typing-dot"></div>
          </div>
        </div>
      `;
      msgList.appendChild(typing);
      scrollMessages();
      fullResponse = "";
    },

    onToken(text) {
      // Replace typing indicator with live text on first token
      let liveEl = $("#vance-live-msg");
      if (!liveEl) {
        const indicator = $("#typing-indicator");
        if (indicator) indicator.remove();

        liveEl    = document.createElement("div");
        liveEl.id = "vance-live-msg";
        liveEl.className = "msg assistant";
        liveEl.innerHTML = `<div class="msg-bubble glass-sm" id="vance-live-bubble"></div>`;
        msgList.appendChild(liveEl);
      }
      fullResponse += text;
      const bubble = $("#vance-live-bubble");
      if (bubble) bubble.innerHTML = renderMarkdown(fullResponse);
      scrollMessages();
    },

    onDone() {
      sendBtn.disabled    = false;
      statusDot.className = "status-dot";

      const liveEl = $("#vance-live-msg");
      if (liveEl) liveEl.id = "";

      // Add copy buttons to code blocks
      $$("pre", msgList).forEach(pre => {
        if (pre.querySelector(".copy-code-btn")) return;
        const btn = document.createElement("button");
        btn.className   = "copy-code-btn";
        btn.textContent = "Copy";
        btn.addEventListener("click", () => {
          navigator.clipboard.writeText(pre.textContent.replace("Copy", "").trim());
          btn.textContent = "Copied!";
          btn.classList.add("copied");
          setTimeout(() => { btn.textContent = "Copy"; btn.classList.remove("copied"); }, 2000);
        });
        pre.style.position = "relative";
        pre.appendChild(btn);
      });
    },

    onError(msg) {
      sendBtn.disabled    = false;
      statusDot.className = "status-dot offline";
      const indicator = $("#typing-indicator");
      if (indicator) indicator.remove();
      appendMsg("assistant", `⚠️ ${msg}. Make sure the backend is running: \`node backend/server.js\``);
      toast("Vance AI error — is the backend running?", "error");
    },
  });

  // ── Open / close drawer ──────────────────────────────────
  function openDrawer()  { drawer.classList.add("open"); textarea.focus(); }
  function closeDrawer() { drawer.classList.remove("open"); }

  fab.addEventListener("click", openDrawer);
  closeBtn.addEventListener("click", closeDrawer);
  backdrop.addEventListener("click", closeDrawer);

  // Cmd/Ctrl+K shortcut (FR-3.2)
  document.addEventListener("keydown", (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "k") {
      e.preventDefault();
      drawer.classList.contains("open") ? closeDrawer() : openDrawer();
    }
    if (e.key === "Escape" && drawer.classList.contains("open")) closeDrawer();
  });

  // ── Mode tabs ────────────────────────────────────────────
  modeBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      modeBtns.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      currentMode = btn.dataset.mode;
      vance.setMode(currentMode);
    });
  });

  // ── Send message ─────────────────────────────────────────
  function sendMessage() {
    const text = textarea.value.trim();
    if (!text || vance.isStreaming) return;
    appendMsg("user", text);
    textarea.value = "";
    autoResizeTextarea();
    vance.send(text);
  }

  sendBtn.addEventListener("click", sendMessage);
  textarea.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  // Auto-resize textarea
  textarea.addEventListener("input", autoResizeTextarea);
  function autoResizeTextarea() {
    textarea.style.height = "auto";
    textarea.style.height = Math.min(textarea.scrollHeight, 120) + "px";
  }

  // ── Clear conversation ───────────────────────────────────
  $("#vance-clear-btn").addEventListener("click", () => {
    msgList.innerHTML = "";
    vance.resetConversation();
    toast("Conversation cleared");
  });

  function appendMsg(role, text) {
    const el = document.createElement("div");
    el.className = `msg ${role}`;
    el.innerHTML = `<div class="msg-bubble ${role === "assistant" ? "glass-sm" : ""}">${renderMarkdown(text)}</div>`;
    msgList.appendChild(el);
    scrollMessages();
  }

  function scrollMessages() {
    msgList.scrollTop = msgList.scrollHeight;
  }

  return vance;
}

// ══════════════════════════════════════════════════════════════
// Markdown renderer (minimal, no deps)
// ══════════════════════════════════════════════════════════════
function renderMarkdown(text) {
  return text
    // Code blocks
    .replace(/```(\w*)\n?([\s\S]*?)```/g, (_, lang, code) =>
      `<pre><code class="lang-${lang || "text"}">${escHtml(code.trim())}</code></pre>`)
    // Inline code
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    // Bold
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    // Italic
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    // Headers
    .replace(/^### (.+)$/gm, '<h4 style="margin:0.5em 0 0.25em;font-size:0.85em;color:var(--accent-gold)">$1</h4>')
    .replace(/^## (.+)$/gm,  '<h3 style="margin:0.5em 0 0.25em;font-size:0.95em">$1</h3>')
    .replace(/^# (.+)$/gm,   '<h2 style="margin:0.5em 0 0.25em">$1</h2>')
    // Bullet lists
    .replace(/^[-•] (.+)$/gm, '<li style="margin-left:1em;list-style:disc">$1</li>')
    // Numbered lists
    .replace(/^\d+\. (.+)$/gm, '<li style="margin-left:1em;list-style:decimal">$1</li>')
    // Newlines → <br>
    .replace(/\n/g, "<br>");
}

function escHtml(str) {
  return str.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
}

function isInputFocused() {
  const el = document.activeElement;
  return el && (el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.isContentEditable);
}

// ══════════════════════════════════════════════════════════════
// Status Bar
// ══════════════════════════════════════════════════════════════
function initStatusBar() {
  const timeEl = $("#status-time");

  function updateTime() {
    const now = new Date();
    timeEl.textContent = now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
  }

  updateTime();
  setInterval(updateTime, 1000);

  // Check backend health
  fetch("http://localhost:3001/health")
    .then(r => r.json())
    .then(() => {
      const dot = $("#vance-status-dot");
      if (dot) dot.className = "status-dot";
    })
    .catch(() => {
      const dot = $("#vance-status-dot");
      if (dot) dot.className = "status-dot offline";
    });
}

// ══════════════════════════════════════════════════════════════
// PWA Service Worker registration
// ══════════════════════════════════════════════════════════════
function registerSW() {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("/sw.js")
      .then(() => console.log("[WayneOS] Service Worker registered"))
      .catch(e => console.warn("[WayneOS] SW registration failed:", e));
  }
}

// ══════════════════════════════════════════════════════════════
// BOOT
// ══════════════════════════════════════════════════════════════
document.addEventListener("DOMContentLoaded", () => {
  const mixer     = initAudio();
  const telemetry = initTelemetry();
  const engine    = initPomodoro(mixer, telemetry);
  initTasks();
  initVance(mixer);
  initStatusBar();
  registerSW();

  console.log(
    "%cWayneOS // Midnight Focus Studio",
    "color:#E5C158;font-size:16px;font-weight:bold;font-family:monospace"
  );
  console.log("%cReady. Press Space to start focus. Cmd+K for Vance AI.", "color:#666");
});
