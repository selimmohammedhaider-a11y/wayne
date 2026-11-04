# WayneOS // Midnight Focus Studio

> A distraction-free deep work PWA — Precision Pomodoro · Gotham Soundscape · Vance AI · Flow Telemetry

## Quick Start

### 1. Backend (Vance AI Gateway)

```bash
cd backend
cp .env.example .env
# → Edit .env, add your GEMINI_API_KEY
npm install
npm start
# Running on http://localhost:3001
```

### 2. Frontend

Open `index.html` in a live server (VS Code Live Server, or):

```bash
# Using npx
npx serve . -p 5500
# Then open http://localhost:5500
```

> **Note:** The frontend runs fine as a plain file, but PWA features (Service Worker, offline) require an HTTP server. Chrome requires HTTPS or localhost for `navigator.serviceWorker`.

---

## Architecture

```
wayn os/
├── index.html              ← PWA shell
├── manifest.json           ← PWA manifest
├── sw.js                   ← Service Worker (offline cache)
├── css/
│   ├── reset.css           ← Modern reset
│   ├── design-system.css   ← Design tokens, glassmorphism vars
│   ├── layout.css          ← Responsive grid, header, Vance drawer
│   ├── components.css      ← All UI components
│   └── animations.css      ← Keyframes & transitions
├── js/
│   ├── app.js              ← Main orchestrator & UI bindings
│   ├── pomodoro.js         ← Date.now()-delta timer engine
│   ├── audio.js            ← Web Audio API procedural soundscape
│   ├── vance.js            ← Gemini SSE streaming client
│   ├── tasks.js            ← 3-task queue logic
│   ├── telemetry.js        ← Flow chart + CSV/JSON/webhook export
│   └── storage.js          ← LocalStorage persistence
└── backend/
    ├── server.js           ← Express + Gemini 3.8 Flash proxy
    └── package.json
```

## Features

| Feature | Details |
|---|---|
| **Pomodoro** | 50/10 · 25/5 · 90/20 presets, SVG ring, `Date.now()` delta (no throttle skew), +5 min extend, Space shortcut |
| **Soundscape** | 5-stem procedural Web Audio noise (rain, thunder, subway, vinyl, jazz drone), 3 scene presets, master gain |
| **Vance AI** | Gemini 3.8 Flash streaming via backend proxy, Code/Concept/Sprint modes, `Cmd+K` drawer, markdown+code rendering |
| **Task Queue** | Strict 3-task ceiling, inline edit, localStorage persistence |
| **Telemetry** | 7-day bar chart, 4h daily threshold, JSON/CSV export, Google Sheets webhook |
| **PWA** | Service Worker offline cache, Web App Manifest, iOS/Android installable |
| **Audio Ducking** | Auto -12dB attenuation when Vance AI responds |
| **Responsive** | 3-col desktop → 2-col tablet → 1-col mobile |

## Keyboard Shortcuts

| Key | Action |
|---|---|
| `Space` | Play / Pause focus timer |
| `Cmd/Ctrl + K` | Toggle Vance AI drawer |
| `Esc` | Close Vance drawer |
| `Enter` (in Vance) | Send message |
| `Shift+Enter` | Newline in Vance textarea |

## Environment Variables

```
GEMINI_API_KEY=your_api_key_here
PORT=3001  (optional, default 3001)
```

Get your API key at [aistudio.google.com](https://aistudio.google.com).
