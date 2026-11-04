// WayneOS Audio — Web Audio API Soundscape Mixer (FR-2.x)
// Generates procedural noise stems — no external audio files required.

export const STEMS = [
  {
    id: "rain",
    icon: "🌧️",
    name: "Gotham Rain",
    desc: "High-pass slate downpour",
    defaultVol: 0.5,
    type: "highpass-noise",
    frequency: 3000,
    q: 1.0,
  },
  {
    id: "thunder",
    icon: "⛈️",
    name: "Distant Thunder",
    desc: "Sub-bass rumble & mist",
    defaultVol: 0.25,
    type: "lowpass-noise",
    frequency: 80,
    q: 2.0,
  },
  {
    id: "subway",
    icon: "🚇",
    name: "MTA Subway Rumble",
    desc: "Mid-range mechanical rail hum",
    defaultVol: 0.3,
    type: "bandpass-noise",
    frequency: 400,
    q: 0.8,
  },
  {
    id: "vinyl",
    icon: "📻",
    name: "Vinyl Crackle",
    desc: "Analog warmth & tape hiss",
    defaultVol: 0.2,
    type: "highshelf-noise",
    frequency: 8000,
    q: 0.5,
  },
  {
    id: "jazz",
    icon: "🎷",
    name: "Midnight Rhodes",
    desc: "Melancholic chord sustain",
    defaultVol: 0.35,
    type: "jazz-drone",
    frequency: 220,
    q: 1,
  },
];

export const SCENE_PRESETS = {
  "Rainy Study": { rain: 0.6, thunder: 0.3, subway: 0.1, vinyl: 0.25, jazz: 0.4, master: 0.7 },
  "Late Night Code": { rain: 0.3, thunder: 0.15, subway: 0.5, vinyl: 0.3, jazz: 0.5, master: 0.65 },
  "Subway Drizzle": { rain: 0.4, thunder: 0.2, subway: 0.7, vinyl: 0.15, jazz: 0.2, master: 0.6 },
};

export class SoundscapeMixer {
  constructor() {
    this.ctx      = null;
    this.master   = null;
    this.duckGain = null;   // For Vance AI auto-ducking
    this.stems    = {};     // id → { source, filter, gainNode, vol }
    this._started = false;
    this.masterVol = 0.65;
  }

  // Lazy-init AudioContext on first user gesture
  _ensureContext() {
    if (this.ctx) return;
    this.ctx      = new (window.AudioContext || window.webkitAudioContext)();
    this.duckGain = this.ctx.createGain();
    this.master   = this.ctx.createGain();
    this.duckGain.connect(this.master);
    this.master.connect(this.ctx.destination);
    this.master.gain.value = this.masterVol;
    this.duckGain.gain.value = 1.0;
  }

  _createWhiteNoiseSource() {
    const bufferSize = this.ctx.sampleRate * 2;
    const buffer     = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data       = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
    const source = this.ctx.createBufferSource();
    source.buffer = buffer;
    source.loop   = true;
    return source;
  }

  _createJazzDrone(frequency) {
    // Simple drone: root + minor third + fifth oscillators
    const oscNodes = [];
    const freqs = [frequency, frequency * 1.189, frequency * 1.498, frequency * 2];
    freqs.forEach((freq, i) => {
      const osc = this.ctx.createOscillator();
      osc.type = i < 2 ? "sine" : "triangle";
      osc.frequency.value = freq;
      const detune = this.ctx.createOscillator();
      detune.type = "sine";
      detune.frequency.value = 0.15 + i * 0.07; // very slow LFO-like drift
      osc.start();
      oscNodes.push(osc);
    });
    // Mix them
    const merger = this.ctx.createGain();
    merger.gain.value = 0.25;
    oscNodes.forEach(o => o.connect(merger));
    return { source: merger, isOsc: true, nodes: oscNodes };
  }

  _buildStem(stemDef) {
    const gainNode = this.ctx.createGain();
    gainNode.gain.value = 0;
    gainNode.connect(this.duckGain);

    let sourceNode;
    let isOsc = false;
    let extraNodes = [];

    if (stemDef.type === "jazz-drone") {
      const { source, nodes } = this._createJazzDrone(stemDef.frequency);
      sourceNode  = source;
      isOsc       = true;
      extraNodes  = nodes;
      // Add reverb-like filter
      const filter = this.ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.value = 1200;
      sourceNode.connect(filter);
      filter.connect(gainNode);
    } else {
      const noise  = this._createWhiteNoiseSource();
      const filter = this.ctx.createBiquadFilter();
      sourceNode   = noise;

      switch (stemDef.type) {
        case "highpass-noise":
          filter.type = "highpass";
          filter.frequency.value = stemDef.frequency;
          filter.Q.value = stemDef.q;
          break;
        case "lowpass-noise":
          filter.type = "lowpass";
          filter.frequency.value = stemDef.frequency;
          filter.Q.value = stemDef.q;
          break;
        case "bandpass-noise":
          filter.type = "bandpass";
          filter.frequency.value = stemDef.frequency;
          filter.Q.value = stemDef.q;
          break;
        case "highshelf-noise":
          filter.type = "highshelf";
          filter.frequency.value = stemDef.frequency;
          filter.gain.value = 6;
          break;
        default:
          filter.type = "allpass";
      }

      noise.connect(filter);
      filter.connect(gainNode);
      noise.start();
    }

    return { gainNode, sourceNode, isOsc, extraNodes, vol: stemDef.defaultVol };
  }

  startAll() {
    this._ensureContext();
    if (this._started) return;
    this._started = true;

    STEMS.forEach(stemDef => {
      const stem = this._buildStem(stemDef);
      this.stems[stemDef.id] = stem;
      this._rampGain(stem.gainNode, stemDef.defaultVol, 1.5);
    });
  }

  stopAll() {
    if (!this._started) return;
    Object.values(this.stems).forEach(({ gainNode }) => {
      this._rampGain(gainNode, 0, 1.0);
    });
    setTimeout(() => {
      if (this.ctx) {
        this.ctx.suspend();
      }
      this._started = false;
    }, 1200);
  }

  setStemVolume(id, vol) {
    if (!this._started) return;
    const stem = this.stems[id];
    if (!stem) return;
    stem.vol = vol;
    this._rampGain(stem.gainNode, vol, 0.1);
  }

  setMasterVolume(vol) {
    this.masterVol = vol;
    if (!this.master) return;
    this._rampGain(this.master, vol, 0.1);
  }

  loadPreset(presetName) {
    const preset = SCENE_PRESETS[presetName];
    if (!preset) return;
    if (!this._started) this.startAll();
    Object.entries(preset).forEach(([id, vol]) => {
      if (id === "master") {
        this.setMasterVolume(vol);
      } else {
        this.setStemVolume(id, vol);
      }
    });
    return preset;
  }

  // Vocal auto-ducking: smooth -12dB attenuation when Vance is speaking (FR-2.3)
  duck(enable) {
    if (!this.duckGain) return;
    // -12dB = 10^(-12/20) ≈ 0.251
    const target = enable ? 0.251 : 1.0;
    this._rampGain(this.duckGain, target, 0.5);
  }

  // Cadence crossfade: 4-second logarithmic decay on session end (FR-2.3)
  fadeOutOnSessionEnd() {
    if (!this.master) return;
    const ctx      = this.ctx;
    const gain     = this.master.gain;
    const startVal = gain.value;
    const fadeTime = 4.0;
    gain.setValueAtTime(startVal, ctx.currentTime);
    gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + fadeTime);
    // Restore after break
    setTimeout(() => {
      gain.setValueAtTime(0.001, ctx.currentTime);
      gain.linearRampToValueAtTime(startVal, ctx.currentTime + 1.5);
    }, (fadeTime + 1.5) * 1000);
  }

  _rampGain(gainNode, target, duration = 0.1) {
    const ctx   = this.ctx || (window.AudioContext && new AudioContext());
    if (!ctx) return;
    const safeT = Math.max(target, 0.0001);
    gainNode.gain.cancelScheduledValues(ctx.currentTime);
    gainNode.gain.setValueAtTime(gainNode.gain.value || 0.0001, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(safeT, ctx.currentTime + duration);
  }
}
