// Procedurally synthesizes the demo tracks shipped with the app.
// Produces 16-bit mono WAV files (converted to mp3 when ffmpeg is available).
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const SR = 32000;
const OUT = resolve(process.cwd(), "public/tracks");
mkdirSync(OUT, { recursive: true });

const NOTE = { C: 0, "C#": 1, D: 2, "D#": 3, E: 4, F: 5, "F#": 6, G: 7, "G#": 8, A: 9, "A#": 10, B: 11 };
const freq = (name, octave) => 440 * Math.pow(2, (NOTE[name] + (octave - 4) * 12 - 9) / 12);

function makeRng(seed) {
  let s = seed >>> 0;
  return () => {
    s ^= s << 13; s >>>= 0;
    s ^= s >> 17;
    s ^= s << 5; s >>>= 0;
    return s / 4294967296;
  };
}

class LowPass {
  constructor() { this.y = 0; }
  run(x, cutoff) {
    const a = Math.min(0.999, (2 * Math.PI * cutoff) / SR);
    this.y += a * (x - this.y);
    return this.y;
  }
}

function softClip(x) {
  return Math.tanh(x * 1.1);
}

function env(t, a, d, s, r, dur) {
  if (t < 0) return 0;
  if (t < a) return t / a;
  if (t < a + d) return 1 - ((1 - s) * (t - a)) / d;
  if (t < dur - r) return s;
  if (t < dur) return s * (1 - (t - (dur - r)) / r);
  return 0;
}

function synth(spec) {
  const { bpm, bars, chords, seed, style, root } = spec;
  const rng = makeRng(seed);
  const spb = 60 / bpm;
  const dur = bars * 4 * spb;
  const n = Math.floor(dur * SR);
  const buf = new Float32Array(n);

  const delayLen = Math.floor(spb * 0.75 * SR);
  const delay = new Float32Array(delayLen);
  let dIdx = 0;

  const padFilter = new LowPass();
  const hatFilter = new LowPass();
  const noiseFilter = new LowPass();

  for (let i = 0; i < n; i++) {
    const t = i / SR;
    const beat = t / spb;
    const bar = Math.floor(beat / 4);
    const chord = chords[bar % chords.length];
    const beatInBar = beat % 4;
    let out = 0;

    // ---- pad / chord bed -------------------------------------------------
    const barT = (beat % 4) * spb;
    const padEnv = env(barT, 0.45, 0.9, 0.55, 0.6, 4 * spb);
    for (let v = 0; v < chord.length; v++) {
      const f = freq(chord[v][0], chord[v][1]);
      const det = 1 + (v - 1) * 0.0016;
      const saw =
        Math.sin(2 * Math.PI * f * det * t) * 0.6 +
        Math.sin(2 * Math.PI * f * 2 * det * t) * 0.18 +
        Math.sin(2 * Math.PI * f * 3 * det * t) * 0.08;
      out += saw * padEnv * 0.1;
    }
    const sweep = 620 + 420 * Math.sin((2 * Math.PI * t) / (8 * spb));
    out = padFilter.run(out, sweep);

    // ---- bass ------------------------------------------------------------
    const bassStep = Math.floor(beat * 2) % 8;
    const bassT = (beat * 2 - Math.floor(beat * 2)) * (spb / 2);
    const bf = freq(chord[0][0], style === "drive" ? 2 : 2) * (bassStep % 4 === 3 ? 1.5 : 1);
    const bEnv = env(bassT, 0.008, 0.12, 0.45, 0.08, spb / 2);
    out +=
      (Math.sin(2 * Math.PI * bf * t) * 0.75 + Math.sin(4 * Math.PI * bf * t) * 0.14) *
      bEnv *
      0.42;

    // ---- lead / arp ------------------------------------------------------
    const div = style === "ambient" ? 1 : 2;
    const stepIdx = Math.floor(beat * div);
    const stepT = (beat * div - stepIdx) * (spb / div);
    const voice = chord[(stepIdx + bar) % chord.length];
    const lf = freq(voice[0], voice[1] + (style === "ambient" ? 1 : 2));
    const lEnv = env(stepT, 0.01, 0.18, 0.0, 0.05, spb / div);
    const lead =
      (Math.sin(2 * Math.PI * lf * t) * 0.6 + Math.sin(2 * Math.PI * lf * 2.01 * t) * 0.2) *
      lEnv *
      (style === "ambient" ? 0.1 : 0.16);
    out += lead;

    // ---- drums -----------------------------------------------------------
    if (style !== "ambient") {
      const kickOn = beatInBar % (style === "drive" ? 1 : 2) < 0.0005 + 1 / (spb * SR);
      const kPhase = (beat % (style === "drive" ? 1 : 2)) * spb;
      if (kPhase < 0.3) {
        const kf = 130 * Math.exp(-kPhase * 26) + 42;
        out += Math.sin(2 * Math.PI * kf * kPhase) * Math.exp(-kPhase * 11) * 0.72;
      }
      void kickOn;
      const sPhase = ((beat + 2) % 4) * spb;
      if (sPhase < 0.22) {
        const noise = rng() * 2 - 1;
        out += noiseFilter.run(noise, 2600) * Math.exp(-sPhase * 22) * 0.3;
      }
      const hPhase = (beat % 0.5) * spb;
      if (hPhase < 0.07) {
        const noise = rng() * 2 - 1;
        out += (noise - hatFilter.run(noise, 5200)) * Math.exp(-hPhase * 70) * 0.17;
      }
    } else {
      const sPhase = ((beat + 2) % 8) * spb;
      if (sPhase < 1.6) {
        const noise = rng() * 2 - 1;
        out += noiseFilter.run(noise, 900) * Math.exp(-sPhase * 2.2) * 0.07;
      }
    }

    // ---- delay send ------------------------------------------------------
    const wet = delay[dIdx];
    out += wet * 0.34;
    delay[dIdx] = softClip(lead + wet * 0.42);
    dIdx = (dIdx + 1) % delayLen;

    // ---- master ----------------------------------------------------------
    const fadeIn = Math.min(1, t / 1.1);
    const fadeOut = Math.min(1, (dur - t) / 1.6);
    buf[i] = softClip(out * 0.82) * fadeIn * fadeOut;
  }

  void root;
  return buf;
}

function toWav(samples) {
  const data = Buffer.alloc(samples.length * 2);
  let peak = 0;
  for (let i = 0; i < samples.length; i++) peak = Math.max(peak, Math.abs(samples[i]));
  const gain = peak > 0 ? 0.92 / peak : 1;
  for (let i = 0; i < samples.length; i++) {
    const v = Math.max(-1, Math.min(1, samples[i] * gain));
    data.writeInt16LE(Math.round(v * 32767), i * 2);
  }
  const header = Buffer.alloc(44);
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + data.length, 4);
  header.write("WAVE", 8);
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(SR, 24);
  header.writeUInt32LE(SR * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write("data", 36);
  header.writeUInt32LE(data.length, 40);
  return Buffer.concat([header, data]);
}

const Am = [["A", 3], ["C", 4], ["E", 4]];
const F = [["F", 3], ["A", 3], ["C", 4]];
const C = [["C", 3], ["E", 3], ["G", 3]];
const G = [["G", 3], ["B", 3], ["D", 4]];
const Dm = [["D", 3], ["F", 3], ["A", 3]];
const Fm = [["F", 3], ["G#", 3], ["C", 4]];
const Cm = [["C", 3], ["D#", 3], ["G", 3]];
const Gs = [["G#", 3], ["C", 4], ["D#", 4]];
const Bb = [["A#", 3], ["D", 4], ["F", 4]];

const tracks = [
  { file: "neon-veil", bpm: 84, bars: 8, chords: [Am, F, C, G], seed: 7, style: "lofi" },
  { file: "blindfold-protocol", bpm: 96, bars: 8, chords: [Fm, Gs, Cm, Bb], seed: 21, style: "lofi" },
  { file: "midnight-drive", bpm: 124, bars: 12, chords: [Cm, Gs, Bb, Fm], seed: 42, style: "drive" },
  { file: "echo-chamber", bpm: 68, bars: 6, chords: [Dm, Am, F, C], seed: 99, style: "ambient" },
  { file: "static-bloom", bpm: 112, bars: 10, chords: [Am, G, F, G], seed: 128, style: "drive" },
];

for (const t of tracks) {
  const samples = synth(t);
  writeFileSync(resolve(OUT, `${t.file}.wav`), toWav(samples));
  console.log(`wrote ${t.file}.wav  ${(samples.length / SR).toFixed(1)}s`);
}
