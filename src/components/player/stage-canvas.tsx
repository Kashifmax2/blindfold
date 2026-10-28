"use client";

import { useCallback, useEffect, useRef } from "react";
import { heatRgb } from "@/lib/tiers";
import { perf, type PerfProfile } from "@/lib/perf";
import { usePlayer, type AudioLevels } from "./player-provider";

/* ==========================================================================
   STAGE CANVAS — one optimised canvas pair for every full-screen effect.
   Previously this was 3 separate full-screen canvases + 2 backdrop-blurred
   panels, each clearing and re-filling the whole viewport every frame. All of
   that work now happens here, with:
     • DPR capped per device (biggest single fill-rate saving)
     • gradient objects created once per frame instead of thousands
     • particle pools with hard caps scaled by device quality
     • layers switched off automatically on weak machines
     • no effect is ever removed — only its cost is reduced
   ========================================================================== */

type RGB = [number, number, number];
type P = { x: number; y: number; vx: number; vy: number; life: number; max: number; size: number; c: RGB; drag: number; grav: number; streak: boolean };
type Bolt = { main: number[]; branches: number[][]; life: number; max: number; c: RGB; w: number };
type Crack = { x: number; y: number; lines: number[][]; life: number; max: number; c: RGB };
type Wave = { x: number; y: number; r: number; sp: number; life: number; max: number; c: RGB; w: number; f: number };
type Comet = { x: number; y: number; vx: number; vy: number; life: number; max: number; c: RGB; size: number };
type Orb = { x: number; y: number; r: number; a: number; sp: number; ph: number };
type Slice = { y: number; h: number; dx: number; c: RGB };
type Grain = { h: number; a: number; s: number; size: number };

const rand = (a: number, b: number) => a + Math.random() * (b - a);
const chance = (p: number) => Math.random() < p;
const rgba = (c: RGB, a: number) => `rgba(${c[0]},${c[1]},${c[2]},${a < 0 ? 0 : a > 1 ? 1 : a})`;
const lighten = (c: RGB, t: number): RGB => [Math.round(c[0] + (255 - c[0]) * t), Math.round(c[1] + (255 - c[1]) * t), Math.round(c[2] + (255 - c[2]) * t)];

function path(ctx: CanvasRenderingContext2D, pts: number[], upTo = pts.length) {
  if (pts.length < 4) return;
  ctx.beginPath();
  ctx.moveTo(pts[0], pts[1]);
  for (let i = 2; i < upTo - 1; i += 2) ctx.lineTo(pts[i], pts[i + 1]);
  ctx.stroke();
}

function boltPath(x1: number, y1: number, x2: number, y2: number, rough: number, steps: number) {
  let pts = [x1, y1, x2, y2];
  let disp = Math.hypot(x2 - x1, y2 - y1) * rough;
  for (let it = 0; it < steps; it += 1) {
    const next: number[] = [];
    for (let i = 0; i < pts.length - 2; i += 2) {
      const ax = pts[i], ay = pts[i + 1], bx = pts[i + 2], by = pts[i + 3];
      const mx = (ax + bx) / 2, my = (ay + by) / 2;
      const len = Math.hypot(bx - ax, by - ay) || 1;
      const off = (Math.random() - 0.5) * disp;
      next.push(ax, ay, mx + (-(by - ay) / len) * off, my + ((bx - ax) / len) * off);
    }
    next.push(pts[pts.length - 2], pts[pts.length - 1]);
    pts = next;
    disp *= 0.55;
  }
  return pts;
}

function crackLines(x: number, y: number, size: number) {
  const lines: number[][] = [];
  const rays = 8;
  const grow = (sx: number, sy: number, ang: number, len: number, depth: number) => {
    const line = [sx, sy];
    let cx = sx, cy = sy, a = ang, gone = 0;
    while (gone < len) {
      const step = rand(10, 26);
      a += rand(-0.4, 0.4);
      cx += Math.cos(a) * step;
      cy += Math.sin(a) * step;
      gone += step;
      line.push(cx, cy);
      if (depth < 1 && chance(0.16)) grow(cx, cy, a + rand(-1, 1), (len - gone) * 0.5, depth + 1);
    }
    lines.push(line);
  };
  for (let i = 0; i < rays; i += 1) grow(x, y, (i / rays) * Math.PI * 2 + rand(-0.3, 0.3), size * rand(0.6, 1), 0);
  const ring: number[] = [];
  const r = size * 0.42;
  for (let s = 0; s <= 10; s += 1) {
    const a = (s / 10) * Math.PI * 2;
    const rr = r * rand(0.85, 1.1);
    ring.push(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
  }
  lines.push(ring);
  return lines;
}

export function StageCanvas() {
  const { onFrame } = usePlayer();
  const backRef = useRef<HTMLCanvasElement | null>(null);
  const frontRef = useRef<HTMLCanvasElement | null>(null);
  const backCtx = useRef<CanvasRenderingContext2D | null>(null);
  const frontCtx = useRef<CanvasRenderingContext2D | null>(null);
  const size = useRef({ w: 0, h: 0 });
  const profile = useRef<PerfProfile>(perf().profile);
  const visible = useRef(true);

  const S = useRef({
    last: 0,
    seed: 0.41,
    // rails
    beams: [] as Array<{ y: number; side: -1 | 1; p: number; len: number; w: number }>,
    sparks: [] as Array<{ y: number; vy: number; side: -1 | 1; r: number; ph: number }>,
    railFlash: 0,
    lastBeat: 0,
    lastIdle: 0,
    scan: 0,
    // storm
    ps: [] as P[],
    bolts: [] as Bolt[],
    cracks: [] as Crack[],
    waves: [] as Wave[],
    comets: [] as Comet[],
    orbs: [] as Orb[],
    slices: { frames: 0, list: [] as Slice[] },
    grains: [] as Grain[],
    disk: [] as Grain[],
    strobe: 0,
    strobeC: [255, 255, 255] as RGB,
    tor: { on: 0, until: 0, cx: 0.5, ph: 0 },
    sing: 0,
    spin: 0,
    aur: 0,
    aurT: 0,
    cd: {} as Record<string, number>,
    boltTimer: 0,
    crackTimer: 0,
    cometTimer: 0,
  });

  const ready = useCallback((key: string, ms: number, now: number) => {
    const s = S.current;
    if ((s.cd[key] ?? 0) > now) return false;
    s.cd[key] = now + ms;
    return true;
  }, []);

  /* ------------------------------ sizing ------------------------------- */
  useEffect(() => {
    const resize = () => {
      const w = window.innerWidth;
      const h = window.innerHeight;
      const dpr = Math.min(window.devicePixelRatio || 1, profile.current.dpr);
      size.current = { w, h };
      for (const [ref, set] of [
        [backRef, backCtx],
        [frontRef, frontCtx],
      ] as const) {
        const c = ref.current;
        if (!c) continue;
        c.width = Math.max(1, Math.round(w * dpr));
        c.height = Math.max(1, Math.round(h * dpr));
        c.style.width = `${w}px`;
        c.style.height = `${h}px`;
        const ctx = c.getContext("2d", { alpha: true });
        ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);
        set.current = ctx;
      }
      S.current.orbs = [];
    };
    resize();
    window.addEventListener("resize", resize);
    const onVis = () => {
      visible.current = !document.hidden;
      S.current.last = 0;
    };
    document.addEventListener("visibilitychange", onVis);
    const unsub = perf().subscribe((p) => {
      const dprChanged = p.dpr !== profile.current.dpr;
      profile.current = p;
      if (dprChanged) resize();
    });
    return () => {
      window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", onVis);
      unsub();
    };
  }, []);

  /* ----------------------------- render loop --------------------------- */
  useEffect(() => {
    const rng = () => {
      const s = S.current;
      s.seed = (s.seed * 9301 + 49297) % 233280;
      return s.seed / 233280;
    };

    const spawnBolt = (tc: RGB, w: number, h: number, side: number, strength: number) => {
      const s = S.current;
      const fromRail = chance(0.55);
      let x1: number, y1: number, x2: number, y2: number;
      if (fromRail) {
        const left = chance(0.5);
        x1 = left ? side : w - side;
        y1 = rand(h * 0.06, h * 0.94);
        x2 = left ? rand(w * 0.34, w * 0.86) : rand(w * 0.14, w * 0.66);
        y2 = y1 + rand(-h * 0.3, h * 0.3);
      } else {
        x1 = rand(w * 0.14, w * 0.86);
        y1 = -10;
        x2 = x1 + rand(-w * 0.24, w * 0.24);
        y2 = rand(h * 0.35, h * 0.95);
      }
      const main = boltPath(x1, y1, x2, y2, 0.22, 6);
      const branches: number[][] = [];
      const forks = 1 + Math.floor(strength * 3);
      for (let i = 0; i < forks; i += 1) {
        const idx = 2 * Math.floor(rand(3, main.length / 2 - 3));
        const bx = main[idx], by = main[idx + 1];
        const ang = Math.atan2(y2 - y1, x2 - x1) + rand(-0.9, 0.9);
        const len = Math.hypot(x2 - x1, y2 - y1) * rand(0.15, 0.35);
        branches.push(boltPath(bx, by, bx + Math.cos(ang) * len, by + Math.sin(ang) * len, 0.3, 4));
      }
      s.bolts.push({ main, branches, life: 0, max: rand(8, 14), c: tc, w: 1.4 + strength * 2.2 });
      burst(x2, y2, Math.round(10 * profile.current.density * (0.5 + strength)), 3 + strength * 4, tc);
      if (profile.current.layers.strobe) {
        s.strobe = Math.max(s.strobe, 0.04 + strength * 0.07);
        s.strobeC = lighten(tc, 0.5);
      }
    };

    const burst = (x: number, y: number, n: number, speed: number, c: RGB) => {
      const s = S.current;
      const cap = Math.round(260 * profile.current.density);
      const count = Math.min(n, cap - s.ps.length);
      for (let i = 0; i < count; i += 1) {
        const a = Math.random() * Math.PI * 2;
        const sp = speed * rand(0.4, 1);
        s.ps.push({
          x, y,
          vx: Math.cos(a) * sp,
          vy: Math.sin(a) * sp,
          life: 0, max: rand(34, 70), size: rand(1, 2.4),
          c: chance(0.3) ? lighten(c, 0.6) : c,
          drag: 0.95, grav: 0.06, streak: true,
        });
      }
    };

    const unsub = onFrame((levels) => {
      if (!visible.current) return;
      const now = performance.now();
      const dt = S.current.last ? Math.min(3, (now - S.current.last) / 16.67) : 1;
      S.current.last = now;
      if (dt > 0) perf().report(dt);

      const p = profile.current;
      const { w, h } = size.current;
      if (!w || !h) return;
      const fx = p.layers;
      const s = S.current;

      const heat = levels.heat;
      const tier = levels.tierIndex;
      const tc = heatRgb(heat) as RGB;
      const accent = (() => {
        const n = Number.parseInt(levels.accent.replace("#", ""), 16);
        return Number.isNaN(n) ? tc : ([(n >> 16) & 255, (n >> 8) & 255, n & 255] as RGB);
      })();
      const side = w < 640 ? 28 : w < 1024 ? 44 : w < 1280 ? 60 : 84;
      const kick = levels.kick;
      const playing = levels.playing;
      const scale = 0.4 + heat * 1.5;
      const beat = levels.beat !== s.lastBeat && playing;
      if (beat) s.lastBeat = levels.beat;

      /* ---------------- spawners (beat + continuous) ---------------- */
      // CONTINUOUS LIGHTNING — cadence tightens as the track gets hotter so the
      // sky always crackles, even between drum hits.
      if (fx.lightning && playing) {
        const cadence = 1500 - heat * 1330;
        if (now - s.boltTimer > cadence) {
          s.boltTimer = now;
          spawnBolt(tc, w, h, side, 0.3 + heat * 0.6 + kick * 0.25);
        }
      }
      // CONTINUOUS GLASS CRACKS on heavy passages.
      if (fx.cracks && playing && tier >= 3) {
        const cadence = 3200 - heat * 2200;
        if (now - s.crackTimer > cadence) {
          s.crackTimer = now;
          if (s.cracks.length > 3) s.cracks.shift();
          const x = rand(w * 0.14, w * 0.86);
          const y = rand(h * 0.14, h * 0.86);
          const sizeC = Math.min(w, h) * (0.13 + heat * 0.18);
          s.cracks.push({ x, y, lines: crackLines(x, y, sizeC), life: 0, max: 100, c: tc });
          burst(x, y, Math.round(16 * p.density), 4 + heat * 4, lighten(tc, 0.4));
          if (fx.shockwaves) s.waves.push({ x, y, r: 6, sp: 8, life: 0, max: 32, c: lighten(tc, 0.3), w: 3, f: 2 });
        }
      }
      // Ambient comets so something always drifts across, even on quiet songs.
      if (fx.storm && now - s.cometTimer > (2400 - heat * 1400)) {
        s.cometTimer = now;
        const fromLeft = chance(0.5);
        const sp = rand(6, 10) * (0.7 + heat);
        s.comets.push({
          x: fromLeft ? -30 : w + 30,
          y: rand(-20, h * 0.6),
          vx: (fromLeft ? 1 : -1) * sp,
          vy: rand(0.4, 2.4),
          life: 0, max: 200,
          c: chance(0.5) ? tc : accent,
          size: rand(1.6, 2.8),
        });
      }

      if (beat) {
        s.railFlash = Math.max(s.railFlash, 0.32 + levels.beatStrength * 0.68);
        const n = 2 + Math.round(heat * 5);
        for (let i = 0; i < n; i += 1) {
          s.beams.push({
            y: h * (0.03 + rng() * 0.94),
            side: i % 2 === 0 ? -1 : 1,
            p: 0,
            len: w * (0.12 + rng() * 0.28) * (0.7 + levels.beatStrength),
            w: 1.2 + levels.beatStrength * 2.6,
          });
        }
        const bs = levels.beatStrength;
        if (levels.beatType === "drop") {
          if (fx.shockwaves) s.waves.push({ x: w / 2 + rand(-w * 0.08, w * 0.08), y: h / 2, r: 26, sp: 10, life: 0, max: 62, c: tc, w: 4 + bs * 4, f: 3 + bs * 2 });
          if (fx.lightning && (tier >= 2 || heat > 0.4)) spawnBolt(tc, w, h, side, 0.7 + bs * 0.5);
          burst(rand(w * 0.2, w * 0.8), rand(h * 0.2, h * 0.6), Math.round(22 * p.density * scale), 4 + bs * 4, tc);
        } else if (levels.beatType === "kick") {
          for (let i = 0; i < Math.round(6 * p.density * (1 + heat)); i += 1) {
            const left = i % 2 === 0;
            s.ps.push({
              x: left ? side : w - side, y: rand(0, h),
              vx: (left ? 1 : -1) * rand(4, 9) * (0.6 + bs), vy: rand(-1.4, 1.4),
              life: 0, max: rand(24, 46), size: rand(1, 2),
              c: chance(0.5) ? tc : accent, drag: 0.95, grav: 0, streak: true,
            });
          }
          if (fx.shockwaves) s.waves.push({ x: chance(0.5) ? side : w - side, y: rand(h * 0.2, h * 0.8), r: 8, sp: 7, life: 0, max: 36, c: accent, w: 2 + bs * 2, f: 1.4 });
          if (fx.lightning && tier >= 4 && chance(0.3 + heat * 0.4)) spawnBolt(tc, w, h, side, 0.5 + bs * 0.6);
        } else if (levels.beatType === "snare") {
          if (fx.lightning && chance(0.35 + heat * 0.5)) spawnBolt(tc, w, h, side, 0.4 + bs * 0.5);
          else burst(rand(w * 0.2, w * 0.8), rand(h * 0.2, h * 0.7), Math.round(14 * p.density), 3 + bs * 3, tc);
        } else if (chance(0.5)) {
          burst(rand(w * 0.15, w * 0.85), rand(h * 0.15, h * 0.75), Math.round(8 * p.density), 2 + bs * 2, accent);
        }
        if (fx.tornado && tier >= 4 && now > s.tor.until && chance(0.04) && ready("tor", 9000, now)) {
          s.tor.until = now + rand(5000, 9000);
          s.tor.cx = rand(0.25, 0.75);
        }
      }
      s.railFlash *= 0.88;
      if (!playing && now - s.lastIdle > 1100) {
        s.lastIdle = now;
        for (let i = 0; i < 2; i += 1) {
          s.beams.push({ y: h * (0.05 + Math.random() * 0.9), side: i % 2 === 0 ? -1 : 1, p: 0, len: w * 0.16, w: 1.4 });
        }
      }

      /* --------------------------- physics -------------------------- */
      const torTarget = !fx.tornado ? 0 : tier >= 6 || now < s.tor.until ? Math.min(1, 0.45 + heat * 0.7) : 0;
      s.tor.on += (torTarget - s.tor.on) * 0.03 * dt;
      s.tor.ph += 0.01 * dt;
      const singTarget = !fx.accretion || tier < 8 ? 0 : 1;
      s.sing += (singTarget - s.sing) * 0.02 * dt;
      s.spin += (0.01 + heat * 0.03) * dt;
      const aurTarget = !fx.aurora ? 0 : tier >= 7 ? 1 : tier >= 5 ? 0.35 : 0;
      s.aur += (aurTarget - s.aur) * 0.02 * dt;
      s.aurT += 0.008 * dt * (1 + levels.energy);
      const torX = w * (s.tor.cx + Math.sin(s.tor.ph * 0.7) * 0.12);

      const ps = s.ps;
      for (let i = ps.length - 1; i >= 0; i -= 1) {
        const q = ps[i];
        for (const wv of s.waves) {
          const dx = q.x - wv.x, dy = q.y - wv.y;
          const d = Math.hypot(dx, dy) || 1;
          if (Math.abs(d - wv.r) < 24) {
            const f = (wv.f * (1 - wv.life / wv.max)) / 6;
            q.vx += (dx / d) * f * dt;
            q.vy += (dy / d) * f * dt;
          }
        }
        if (s.tor.on > 0.05) {
          const dx = q.x - torX;
          const radius = 30 + ((h - q.y) / h) * 180;
          const ad = Math.abs(dx);
          if (ad < radius * 2.2) {
            const k = s.tor.on * (1 - ad / (radius * 2.2));
            q.vx += -Math.sign(dx) * 0.18 * k * dt;
            q.vy -= 0.12 * k * dt;
          }
        }
        if (s.sing > 0.05) {
          const dx = w / 2 - q.x, dy = h / 2 - q.y;
          const d2 = Math.max(900, dx * dx + dy * dy);
          q.vx += dx * (s.sing * 700) / d2 * 0.02 * dt + (-dy / Math.sqrt(d2)) * s.sing * 0.08 * dt;
          q.vy += dy * (s.sing * 700) / d2 * 0.02 * dt + (dx / Math.sqrt(d2)) * s.sing * 0.08 * dt;
        }
        q.vy += q.grav * dt;
        const dr = Math.pow(q.drag, dt);
        q.vx *= dr;
        q.vy *= dr;
        q.x += q.vx * dt;
        q.y += q.vy * dt;
        q.life += dt;
        if (q.life >= q.max || q.x < -60 || q.x > w + 60 || q.y < -80 || q.y > h + 80) {
          ps[i] = ps[ps.length - 1];
          ps.pop();
        }
      }

      /* ======================= BACKGROUND CANVAS ==================== */
      const bctx = backCtx.current;
      if (bctx) {
        bctx.clearRect(0, 0, w, h);
        if (fx.background) {
          if (s.orbs.length === 0) {
            const count = Math.round((w < 768 ? 30 : 60) * p.density) + 6;
            s.orbs = Array.from({ length: count }, () => ({
              x: Math.random() * w, y: Math.random() * h,
              r: rand(0.7, 2.4), a: rand(0.15, 1), sp: rand(0.2, 1),
              ph: Math.random() * Math.PI * 2,
            }));
          }
          bctx.globalCompositeOperation = "lighter";
          const glowR = 5 * p.glow * (1 + levels.energy * 1.2);
          for (const o of s.orbs) {
            const speed = 1 + levels.energy * 3 + kick * 3;
            o.y -= (0.15 + o.sp * 0.4) * speed * dt;
            if (beat) o.y -= levels.beatStrength * 8 * o.a;
            if (o.y < -20) {
              o.y = h + 20;
              o.x = Math.random() * w;
            }
            const tw = 0.5 + 0.5 * Math.sin(now / 700 + o.ph);
            const rr = o.r * glowR;
            bctx.fillStyle = rgba(tc, Math.min(1, 0.05 + o.a * 0.22 + levels.energy * 0.25) * tw);
            bctx.beginPath();
            bctx.arc(o.x, o.y, rr, 0, Math.PI * 2);
            bctx.fill();
          }
          bctx.globalCompositeOperation = "source-over";
        }
      }

      /* ========================= FRONT CANVAS ======================= */
      const ctx = frontCtx.current;
      if (!ctx) return;
      ctx.globalCompositeOperation = "source-over";
      ctx.globalAlpha = 1;
      ctx.clearRect(0, 0, w, h);

      // heat vignette — edges glow in the live tier colour
      if (heat > 0.05) {
        const vg = ctx.createRadialGradient(w / 2, h / 2, Math.min(w, h) * 0.36, w / 2, h / 2, Math.max(w, h) * 0.74);
        vg.addColorStop(0, "rgba(0,0,0,0)");
        vg.addColorStop(1, rgba(tc, heat * 0.16 + kick * 0.1));
        ctx.fillStyle = vg;
        ctx.fillRect(0, 0, w, h);
      }

      ctx.globalCompositeOperation = "lighter";

      // aurora ribbons
      if (s.aur > 0.02) {
        for (let band = 0; band < 3; band += 1) {
          const c = heatRgb(Math.min(0.999, heat - band * 0.08)) as RGB;
          const base = h * (0.08 + band * 0.07);
          ctx.beginPath();
          for (let x = 0; x <= w; x += 32) {
            const y = base + Math.sin(x * 0.004 + s.aurT * (1 + band * 0.4)) * 34 + Math.sin(x * 0.011 - s.aurT * 1.7) * 14 * (1 + levels.treble);
            if (x === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          for (let x = w; x >= 0; x -= 32) ctx.lineTo(x, base + 70 + Math.sin(x * 0.005 + s.aurT) * 20);
          ctx.closePath();
          const g = ctx.createLinearGradient(0, base - 30, 0, base + 90);
          g.addColorStop(0, rgba(c, 0));
          g.addColorStop(0.4, rgba(c, 0.09 * s.aur * (1 + levels.energy)));
          g.addColorStop(1, rgba(c, 0));
          ctx.fillStyle = g;
          ctx.fill();
        }
      }

      // shockwaves
      for (let i = s.waves.length - 1; i >= 0; i -= 1) {
        const wv = s.waves[i];
        wv.r += wv.sp * dt;
        wv.sp *= Math.pow(0.97, dt);
        wv.life += dt;
        const f = 1 - wv.life / wv.max;
        if (f <= 0) {
          s.waves.splice(i, 1);
          continue;
        }
        ctx.strokeStyle = rgba(wv.c, f * 0.2);
        ctx.lineWidth = wv.w * 3 * f + 1;
        ctx.beginPath();
        ctx.arc(wv.x, wv.y, wv.r, 0, Math.PI * 2);
        ctx.stroke();
        ctx.strokeStyle = rgba(lighten(wv.c, 0.4), f * 0.7);
        ctx.lineWidth = Math.max(0.8, wv.w * f);
        ctx.stroke();
      }

      // tornado funnel
      if (s.tor.on > 0.02) {
        if (s.grains.length === 0) {
          s.grains = Array.from({ length: Math.round(220 * Math.max(0.4, p.density)) }, () => ({
            h: Math.random(), a: Math.random() * Math.PI * 2, s: rand(0.6, 1.4), size: rand(0.8, 2.4),
          }));
        }
        const height = h * 0.92;
        for (const d of s.grains) {
          d.a += (0.05 + 0.12 * (1 - d.h)) * d.s * dt * (1 + levels.energy * 2);
          d.h += 0.0022 * d.s * dt * (1 + levels.bass);
          if (d.h > 1) {
            d.h = 0;
            d.a = Math.random() * Math.PI * 2;
          }
          const radius = 10 + Math.pow(d.h, 1.6) * (110 + heat * 120);
          const sway = Math.sin(s.tor.ph * 2 + d.h * 3.2) * 40 * d.h;
          const x = torX + sway + Math.cos(d.a) * radius;
          const y = h - d.h * height + Math.sin(d.a) * radius * 0.16;
          const depth = (Math.sin(d.a) + 1) / 2;
          ctx.fillStyle = rgba(depth > 0.5 ? tc : lighten(tc, 0.5), s.tor.on * (0.18 + depth * 0.5));
          ctx.fillRect(x, y, d.size, d.size);
        }
      }

      // singularity accretion disk
      if (s.sing > 0.02) {
        if (s.disk.length === 0) {
          s.disk = Array.from({ length: Math.round(180 * Math.max(0.4, p.density)) }, () => ({
            h: Math.random(), a: Math.random() * Math.PI * 2, s: rand(0.7, 1.3), size: rand(0.8, 2),
          }));
        }
        const cx = w / 2, cy = h / 2;
        const maxR = Math.min(w, h) * 0.42;
        for (const d of s.disk) {
          d.h -= 0.003 * d.s * dt * (1 + levels.energy);
          if (d.h < 0.05) {
            d.h = 1;
            d.a = Math.random() * Math.PI * 2;
          }
          d.a += (0.012 / Math.max(0.08, d.h)) * d.s * dt;
          const r = d.h * maxR;
          ctx.fillStyle = rgba(lighten(tc, 1 - d.h), s.sing * (0.25 + (1 - d.h) * 0.55));
          ctx.fillRect(cx + Math.cos(d.a + s.spin) * r, cy + Math.sin(d.a + s.spin) * r * 0.38, d.size, d.size);
        }
      }

      // particles
      for (const q of ps) {
        const f = 1 - q.life / q.max;
        if (q.streak) {
          ctx.strokeStyle = rgba(q.c, f * 0.7);
          ctx.lineWidth = q.size;
          ctx.beginPath();
          ctx.moveTo(q.x, q.y);
          ctx.lineTo(q.x - q.vx * 2, q.y - q.vy * 2);
          ctx.stroke();
        } else {
          ctx.fillStyle = rgba(q.c, f * 0.85);
          ctx.fillRect(q.x, q.y, q.size, q.size);
        }
      }

      // comets
      for (let i = s.comets.length - 1; i >= 0; i -= 1) {
        const c = s.comets[i];
        c.x += c.vx * dt;
        c.y += c.vy * dt;
        c.life += dt;
        if (c.life > c.max || c.x < -120 || c.x > w + 120 || c.y > h + 120) {
          s.comets.splice(i, 1);
          continue;
        }
        const g = ctx.createLinearGradient(c.x, c.y, c.x - c.vx * 14, c.y - c.vy * 14);
        g.addColorStop(0, rgba(lighten(c.c, 0.6), 0.85));
        g.addColorStop(1, rgba(c.c, 0));
        ctx.strokeStyle = g;
        ctx.lineWidth = c.size * 2;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(c.x, c.y);
        ctx.lineTo(c.x - c.vx * 14, c.y - c.vy * 14);
        ctx.stroke();
      }

      // lightning
      for (let i = s.bolts.length - 1; i >= 0; i -= 1) {
        const b = s.bolts[i];
        b.life += dt;
        if (b.life >= b.max) {
          s.bolts.splice(i, 1);
          continue;
        }
        const f = 1 - b.life / b.max;
        const fl = chance(0.25) ? 0.4 : 1;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.strokeStyle = rgba(b.c, 0.2 * f * fl);
        ctx.lineWidth = b.w * 5;
        path(ctx, b.main);
        ctx.strokeStyle = rgba(lighten(b.c, 0.5), 0.7 * f * fl);
        ctx.lineWidth = b.w * 1.6;
        path(ctx, b.main);
        ctx.strokeStyle = `rgba(255,255,255,${0.95 * f * fl})`;
        ctx.lineWidth = Math.max(0.8, b.w * 0.6);
        path(ctx, b.main);
        ctx.lineWidth = Math.max(0.6, b.w * 0.5);
        for (const br of b.branches) {
          ctx.strokeStyle = rgba(lighten(b.c, 0.3), 0.55 * f * fl);
          path(ctx, br);
        }
      }

      // glass cracks
      ctx.globalCompositeOperation = "source-over";
      for (let i = s.cracks.length - 1; i >= 0; i -= 1) {
        const k = s.cracks[i];
        k.life += dt;
        if (k.life >= k.max) {
          s.cracks.splice(i, 1);
          continue;
        }
        const grow = Math.min(1, k.life / 7);
        const fade = k.life > k.max * 0.55 ? 1 - (k.life - k.max * 0.55) / (k.max * 0.45) : 1;
        const upTo = Math.max(4, Math.floor(8 * grow) * 2);
        for (const line of k.lines) {
          ctx.strokeStyle = rgba(k.c, 0.3 * fade);
          ctx.lineWidth = 2.4;
          path(ctx, line, upTo);
          ctx.strokeStyle = `rgba(255,255,255,${0.7 * fade})`;
          ctx.lineWidth = 0.9;
          path(ctx, line, upTo);
        }
      }

      // glitch slices
      if (fx.glitch && s.slices.frames > 0) {
        s.slices.frames -= 1;
        ctx.globalCompositeOperation = "lighter";
        for (const sl of s.slices.list) {
          ctx.fillStyle = rgba(sl.c, 0.09);
          ctx.fillRect(sl.dx < 0 ? 0 : sl.dx, sl.y, w, sl.h);
          ctx.fillStyle = "rgba(255,0,90,0.06)";
          ctx.fillRect(sl.dx + 4, sl.y + 2, w, Math.max(1, sl.h / 3));
          ctx.fillStyle = "rgba(0,220,255,0.06)";
          ctx.fillRect(sl.dx - 4, sl.y - 2, w, Math.max(1, sl.h / 3));
        }
      }

      // capped soft strobe
      if (fx.strobe && s.strobe > 0.003) {
        ctx.fillStyle = rgba(s.strobeC, s.strobe);
        ctx.fillRect(0, 0, w, h);
        s.strobe *= Math.pow(0.78, dt);
      }

      /* -------------------- SIDE RAILS (front canvas) --------------- */
      ctx.globalCompositeOperation = "source-over";
      const railW = side;
      const pump = 1 + kick * 0.75;

      // edge flash band — the whole edge "beeps"
      const fl2 = s.railFlash;
      if (fl2 > 0.02) {
        ctx.globalCompositeOperation = "lighter";
        const bandW = railW * (1.2 + fl2 * 3.2);
        for (const sd of [-1, 1] as const) {
          const g = ctx.createLinearGradient(sd === -1 ? 0 : w, 0, sd === -1 ? bandW : w - bandW, 0);
          g.addColorStop(0, rgba(tc, fl2 * 0.5));
          g.addColorStop(0.4, rgba(tc, fl2 * 0.16));
          g.addColorStop(1, rgba(tc, 0));
          ctx.fillStyle = g;
          ctx.fillRect(sd === -1 ? 0 : w - bandW, 0, bandW, h);
        }
      }

      // corner blooms
      const bloom = 0.06 + levels.bass * 0.28 + kick * 0.22;
      for (const [cx, cy] of [
        [railW * 0.4, h * 0.02],
        [w - railW * 0.4, h * 0.02],
        [railW * 0.4, h * 0.98],
        [w - railW * 0.4, h * 0.98],
      ] as const) {
        const rad = 200 + heat * 180 + kick * 110;
        const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, rad);
        g.addColorStop(0, rgba(tc, Math.min(0.55, bloom)));
        g.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = g;
        ctx.fillRect(cx - rad, cy - rad, rad * 2, rad * 2);
      }

      // seams + inward glow
      ctx.fillStyle = rgba(tc, Math.min(1, 0.3 + levels.bass * 0.45 + kick * 0.45));
      ctx.fillRect(railW - 1, 0, 1.6 + kick * 1.5, h);
      ctx.fillRect(w - railW - kick * 1.5, 0, 1.6 + kick * 1.5, h);
      ctx.globalCompositeOperation = "lighter";
      const glowW = 26 + kick * 66;
      for (const sd of [-1, 1] as const) {
        const x = sd === -1 ? railW : w - railW;
        const g = ctx.createLinearGradient(x, 0, x + (sd === -1 ? glowW : -glowW), 0);
        g.addColorStop(0, rgba(tc, 0.16 + kick * 0.42));
        g.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = g;
        ctx.fillRect(sd === -1 ? x : x - glowW, 0, glowW, h);
      }

      // full-height spectrum bars (cached gradients, spacing scales with device)
      const step = Math.max(6, Math.round(p.barStep * (w < 640 ? 0.8 : 1)));
      const barH = Math.max(2, Math.round(step * 0.45));
      const count = Math.max(16, Math.floor(h / step));
      const maxLen = railW * 0.95;
      const reach = maxLen * pump;
      const gl = ctx.createLinearGradient(0, 0, reach, 0);
      gl.addColorStop(0, "rgba(255,255,255,0.95)");
      gl.addColorStop(0.15, rgba(tc, 1));
      gl.addColorStop(0.6, rgba(accent, 0.55));
      gl.addColorStop(1, rgba(accent, 0));
      const gr = ctx.createLinearGradient(w, 0, w - reach, 0);
      gr.addColorStop(0, "rgba(255,255,255,0.95)");
      gr.addColorStop(0.15, rgba(tc, 1));
      gr.addColorStop(0.6, rgba(accent, 0.55));
      gr.addColorStop(1, rgba(accent, 0));

      if (levels.fxMode === "MATRIX") {
        const segs = 6;
        const segW = maxLen / segs;
        for (let i = 0; i < count; i += 1) {
          const idx = Math.min(250, 2 + Math.round(Math.pow(i / count, 1.4) * 236));
          const v = levels.freq[idx] / 255;
          const active = Math.max(1, Math.round(v * segs * pump));
          const y = i * step;
          for (let sI = 0; sI < active; sI += 1) {
            const t = sI / (segs * 1.6);
            const [sr, sg, sb] = heatRgb(Math.min(0.999, heat * 0.6 + t));
            ctx.fillStyle = `rgba(${sr},${sg},${sb},${0.35 + t * 0.6})`;
            ctx.fillRect(sI * (segW + 1), y, segW - 1, barH);
            ctx.fillRect(w - (sI + 1) * (segW + 1), y, segW - 1, barH);
          }
        }
      } else {
        for (let i = 0; i < count; i += 1) {
          const idx = Math.min(250, 2 + Math.round(Math.pow(i / count, 1.45) * 236));
          const v = levels.freq[idx] / 255;
          const len = Math.max(3, (railW * 0.14 + v * maxLen * 0.95) * pump);
          const y = i * step;
          ctx.globalAlpha = Math.min(1, 0.4 + v * 0.6 + kick * 0.15);
          ctx.fillStyle = gl;
          ctx.fillRect(0, y, len, barH);
          ctx.fillStyle = gr;
          ctx.fillRect(w - len, y, len, barH);
        }
        ctx.globalAlpha = 1;
      }

      // seam sparks
      if (s.sparks.length === 0) {
        s.sparks = Array.from({ length: Math.round((w < 768 ? 10 : 18) * Math.max(0.4, p.density)) + 4 }, (_, i) => ({
          y: Math.random() * h, vy: rand(0.5, 2), side: i % 2 === 0 ? -1 : 1, r: rand(1, 2), ph: Math.random() * Math.PI * 2,
        }));
      }
      for (const sp of s.sparks) {
        sp.y += sp.vy * (1 + levels.energy * 3 + kick * 4) * dt;
        if (sp.y > h + 10) {
          sp.y = -10;
          sp.ph = Math.random() * Math.PI * 2;
        }
        const x = sp.side === -1 ? railW - 5 : w - railW + 5;
        const pulse = 0.4 + 0.6 * Math.abs(Math.sin(now / 380 + sp.ph));
        const rad = sp.r * (1 + levels.energy + kick) * 7 * p.glow;
        const g = ctx.createRadialGradient(x, sp.y, 0, x, sp.y, rad);
        g.addColorStop(0, rgba(tc, 0.6 * pulse));
        g.addColorStop(1, rgba(tc, 0));
        ctx.fillStyle = g;
        ctx.fillRect(x - rad, sp.y - rad, rad * 2, rad * 2);
        ctx.fillStyle = `rgba(255,255,255,${0.8 * pulse})`;
        ctx.beginPath();
        ctx.arc(x, sp.y, sp.r, 0, Math.PI * 2);
        ctx.fill();
      }

      // inward beams
      const alive: typeof s.beams = [];
      for (const b of s.beams) {
        b.p += 0.026 + b.w * 0.007;
        if (b.p >= 1) continue;
        alive.push(b);
        const origin = b.side === -1 ? railW : w - railW;
        const dir = b.side === -1 ? 1 : -1;
        const head = origin + dir * b.len * b.p;
        const fade = Math.sin(b.p * Math.PI);
        const g = ctx.createLinearGradient(origin, 0, head, 0);
        g.addColorStop(0, rgba(tc, 0.05 + fade * 0.55));
        g.addColorStop(0.65, rgba(accent, fade * 0.4));
        g.addColorStop(1, rgba(accent, 0));
        ctx.strokeStyle = g;
        ctx.lineWidth = b.w;
        ctx.lineCap = "round";
        ctx.beginPath();
        ctx.moveTo(origin, b.y);
        ctx.lineTo(head, b.y);
        ctx.stroke();
        ctx.fillStyle = `rgba(255,255,255,${fade * 0.9})`;
        ctx.beginPath();
        ctx.arc(head, b.y, Math.max(1.4, b.w * 0.7), 0, Math.PI * 2);
        ctx.fill();
      }
      s.beams = alive.slice(-40);

      // scan band
      if (fx.scanline) {
        s.scan = (s.scan + 0.0018 + levels.energy * 0.006) % 1;
        const sy = s.scan * h;
        const sg = ctx.createLinearGradient(0, sy - 90, 0, sy + 90);
        sg.addColorStop(0, rgba(tc, 0));
        sg.addColorStop(0.5, rgba(tc, 0.16 + levels.treble * 0.4));
        sg.addColorStop(1, rgba(tc, 0));
        ctx.fillStyle = sg;
        ctx.fillRect(0, sy - 90, railW, 180);
        ctx.fillRect(w - railW, sy - 90, railW, 180);
      }
    });

    return unsub;
  }, [onFrame, ready]);

  return (
    <>
      <canvas ref={backRef} aria-hidden className="pointer-events-none fixed inset-0 z-0 h-full w-full" />
      <canvas ref={frontRef} aria-hidden className="pointer-events-none fixed inset-0 z-[18] h-full w-full" />
    </>
  );
}
