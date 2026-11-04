# WayneOS // Midnight Focus Studio
## Product Requirements Document (PRD) & Technical Brief

**Document Version:** 1.2  
**Status:** Approved / Ready for Engineering Sprint  
**Target Platform:** Progressive Web Application (Desktop-first & iOS Mobile PWA)  
**Design Paradigm:** Apple Minimalist Dark Glassmorphism / Midnight Obsidian  

---

### 1. Executive Summary & Product Vision

**WayneOS // Midnight Focus Studio** is an atmospheric, distraction-free digital sanctum engineered to turn deep work and study sessions into an immersive ritual. Traditional productivity tooling often oscillates between cold, utilitarian enterprise spreadsheets and overly gamified, distracting habit apps. 

WayneOS eliminates cognitive friction for night-owl engineers, researchers, and creative professionals by consolidating four foundational focus utilities into a single, cohesive interface:
1. **Precision Pomodoro Engine** with tabular jitter-free timing and sprint telemetry.
2. **Layered Gotham/1980s NYC Ambient Soundscape Mixer** utilizing Web Audio API nodes.
3. **Vance AI Companion**, a contextual Google Gemini 2.5 Flash intelligence layer for instant roadblock resolution without external tab context-switching.
4. **Minimalist Task & Flow Telemetry** enforcing a strict 3-task cognitive bandwidth limit and automated webhook exports.

---

### 2. User Personas & Core Workflows

| Persona | Core Pain Point | WayneOS Solution |
| :--- | :--- | :--- |
| **Full-Stack / Systems Developer** | Constant tab thrashing between IDE, documentation, sound apps, and timers. | Embedded Vance AI for instant code review & syntax queries; low-latency ambient background audio with zero memory leak. |
| **Academic Power User / Researcher** | Sensory overload, time-blindness, and rabbit holes during 2 AM study blocks. | Monastic iOS-style countdown ring, strict 3-slot priority queue, and distraction-quenched midnight atmosphere. |
| **Audio & Creative Craftsperson** | Repetitive white noise playlists lacking analog depth and spatial feel. | 5-stem customizable Gotham audio console with continuous Web Audio crossfading and auto-ducking during voice explanations. |

---

### 3. Functional Requirements & Feature Matrix

#### 3.1. Precision Focus Engine (Pomodoro & Cadence)
- **FR-1.1 Cycle Presets**: Instant switching between `Deep Sprint (50/10)`, `Standard (25/5)`, and `Ultradian (90/20)` intervals.
- **FR-1.2 Tabular Timer Display**: Zero-jitter SVG circular ring and tabular monospace numeric countdown (`font-variant-numeric: tabular-nums`).
- **FR-1.3 State Continuity**: `Date.now()` delta calculation against system clock to prevent background tab sleep throttling or skew.
- **FR-1.4 Focus Quick Actions**: Inline `+5 Min` extension, instant `Take Break`, and manual pause/resume with global spacebar shortcut.

#### 3.2. Gotham / 1980s NYC Soundscape Mixer
- **FR-2.1 Discrete 5-Stem Gain Engine**:
  - `Stem 01`: Heavy Gotham Rain (High-pass slate downpour)
  - `Stem 02`: Distant Thunder & Low-Frequency Mist (Sub-bass rumble)
  - `Stem 03`: 1980s MTA Subway Rumble (Mid-range mechanical rail hum)
  - `Stem 04`: 35mm Vinyl Crackle & Tape Hiss (Analog warmth saturation)
  - `Stem 05`: Midnight Rhodes Jazz & Synth Drone (Melancholic chord sustain)
- **FR-2.2 Master Gain & Presets**: Master volume slider with instant preset scene loading (`Rainy Study`, `Late Night Code`, `Subway Drizzle`).
- **FR-2.3 Intelligent Web Audio Automations**:
  - *Vocal Auto-Ducking*: Smooth `-12dB` attenuation of ambient music when Vance AI is generating or speaking.
  - *Cadence Crossfade*: 4-second logarithmic decay to silence when Pomodoro session concludes.

#### 3.3. Vance AI (Study & Deep Work Companion)
- **FR-3.1 Engine Core**: Google Gemini 2.5 Flash API endpoint streaming at `<150ms` latency.
- **FR-3.2 Context-Aware Drawer / Modal**: Activated via floating capsule dock or `Cmd / Ctrl + K`.
- **FR-3.3 High-Signal Formatting**: Strict token-efficient responses; syntax-highlighted code blocks with 1-click clipboard copy, and Markdown math/LaTeX parsing.
- **FR-3.4 Mode Presets**: Fast-toggles for `Code Synthesizer`, `Concept Breakdown`, and `Sprint Summarizer`.

#### 3.4. Session & Task Telemetry
- **FR-4.1 Zero-Clutter Task Queue**: Strict **3-task ceiling** in active triage. Additional tasks must be swapped in, preventing backlog overwhelm.
- **FR-4.2 Flow Activity Chart**: Apple Health-style vertical weekly bar graph reflecting daily focus hours against a 4.0h daily threshold.
- **FR-4.3 Integrations & Automation**:
  - Google Sheets Webhook sync triggered automatically on `ON_SESSION_END`.
  - Client-side JSON & CSV telemetry file export.

---

### 4. Technical Architecture & Non-Functional Requirements

```
+------------------------------------------------------------------------------------+
|                           WayneOS Client (Mobile / PWA)                            |
|             Vanilla HTML5 / CSS3 (Apple Glassmorphism) / Tailwind CSS              |
+--------------------------+------------------------------+--------------------------+
                           |                              |
            +--------------+              +---------------+---------------+
            v                             v                               v
  +-------------------+       +-----------------------+       +----------------------+
  |   Web Audio API   |       |   Vance AI Gateway    |       | Storage & Sync Layer |
  | Multi-Stem Buffers|       |  Gemini 2.5 Flash API |       | LocalStorage / IDB   |
  | Linear Gain Nodes |       |  Streaming SSE / REST |       | Google Sheets Hook   |
  +-------------------+       +-----------------------+       +----------------------+
```

- **Performance (NFR-1)**: Lighthouse Performance score $\ge 95$; First Contentful Paint (FCP) $< 1.0\text{s}$.
- **Resource Constraints (NFR-2)**: Total CPU usage $< 3.5\%$ during concurrent timer tick, audio buffer mixing, and UI backdrop blur.
- **Offline Reliability (NFR-3)**: PWA Service Worker caching all audio loops and UI assets for full offline functionality.
- **Zero Tab-Thrashing KPI**: $\ge 80\%$ of mid-sprint engineering and concept queries resolved inside Vance AI.

---

### 5. Design System & Aesthetic Specifications

- **Theme**: WayneOS // Midnight Focus (Apple Minimal Dark Glassmorphism)
- **Base Background**: Midnight Obsidian (`#090A0F` to `#121318`)
- **Card Surfaces**: Translucent Smoked Quartz (`rgba(22, 24, 30, 0.65)`) with `backdrop-filter: blur(24px) saturate(180%)`
- **Border Treatment**: 1px specular highlight (`rgba(255, 255, 255, 0.08)`) with continuous squircle corners (`rounded-2xl` to `rounded-3xl`)
- **Primary Accent**: Champagne Gold (`#E5C158` / `#D4AF37`) for active progress rings and primary CTA buttons
- **Typography**: Apple SF Pro / Inter for headers and body; SF Mono / Tabular Numbers for countdown timers
