"use client";

import { useEffect, useLayoutEffect, useRef } from "react";
import { usePlayer, type AudioLevels } from "./player-provider";

export function hexToRgb(hex: string) {
  const clean = hex.replace("#", "");
  const value = clean.length === 3 ? clean.replace(/./g, (c) => c + c) : clean;
  const n = Number.parseInt(value, 16);
  if (Number.isNaN(n)) return { r: 53, g: 224, b: 255 };
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

export function useFrame(cb: (levels: AudioLevels) => void) {
  const { onFrame } = usePlayer();
  const ref = useRef(cb);
  useLayoutEffect(() => {
    ref.current = cb;
  });
  useEffect(() => onFrame((levels) => ref.current(levels)), [onFrame]);
}

export function useCanvas(
  draw: (ctx: CanvasRenderingContext2D, levels: AudioLevels, w: number, h: number) => void,
  maxDpr = 2,
) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const sizeRef = useRef({ w: 0, h: 0 });
  const ctxRef = useRef<CanvasRenderingContext2D | null>(null);
  const drawRef = useRef(draw);
  useLayoutEffect(() => {
    drawRef.current = draw;
  });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    ctxRef.current = canvas.getContext("2d");
    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, maxDpr);
      canvas.width = Math.max(1, Math.round(rect.width * dpr));
      canvas.height = Math.max(1, Math.round(rect.height * dpr));
      sizeRef.current = { w: rect.width, h: rect.height };
      ctxRef.current?.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(canvas);
    return () => observer.disconnect();
  }, [maxDpr]);

  useFrame((levels) => {
    const ctx = ctxRef.current;
    if (!ctx) return;
    const { w, h } = sizeRef.current;
    if (w === 0 || h === 0) return;
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
    ctx.clearRect(0, 0, w, h);
    drawRef.current(ctx, levels, w, h);
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;
  });

  return canvasRef;
}
