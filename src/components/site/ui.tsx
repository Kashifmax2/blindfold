"use client";

import Image from "next/image";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { hashSeed } from "@/lib/format";

export function Reveal({
  children,
  delay = 0,
  className = "",
  as: Tag = "div",
}: {
  children: ReactNode;
  delay?: number;
  className?: string;
  as?: "div" | "section" | "li" | "article" | "header";
}) {
  const ref = useRef<HTMLElement | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node) return;
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setVisible(true);
            observer.disconnect();
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -8% 0px" },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <Tag
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ref={ref as any}
      data-visible={visible}
      className={`reveal ${className}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {children}
    </Tag>
  );
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2 rounded-full border border-veil-400/25 bg-veil-400/5 px-3.5 py-1.5 font-sans text-[11px] font-medium tracking-[0.32em] text-veil-300 uppercase">
      <span
        className="h-1.5 w-1.5 rounded-full bg-veil-400"
        style={{ boxShadow: "0 0 10px var(--color-veil-400)" }}
      />
      {children}
    </span>
  );
}

/** Procedurally composed artwork: accent mesh + the blindfold mark. */
export function CoverArt({
  title,
  accent,
  spinning = false,
  rounded = "rounded-2xl",
  className = "",
  priority = false,
}: {
  title: string;
  accent: string;
  spinning?: boolean;
  rounded?: string;
  className?: string;
  priority?: boolean;
}) {
  const seed = hashSeed(title);
  const angle = Math.round(seed * 360);
  const x = 20 + Math.round(seed * 60);
  const y = 18 + Math.round(((seed * 7) % 1) * 56);

  return (
    <div
      className={`relative overflow-hidden ${rounded} ${className}`}
      style={{
        background: `radial-gradient(120% 110% at ${x}% ${y}%, ${accent}66 0%, #0b1016 58%), linear-gradient(${angle}deg, #121a22 0%, #070b10 100%)`,
      }}
    >
      <div
        className="absolute inset-0 opacity-[0.22] mix-blend-screen"
        style={{
          backgroundImage:
            "repeating-linear-gradient(115deg, rgba(255,255,255,0.14) 0 1px, transparent 1px 7px)",
        }}
      />
      <Image
        src="/brand/logo.png"
        alt=""
        fill
        priority={priority}
        sizes="(max-width: 768px) 40vw, 320px"
        className={`object-cover opacity-85 mix-blend-luminosity transition-transform duration-700 ${
          spinning ? "animate-spin-slow" : ""
        }`}
      />
      <div
        className="absolute inset-0 mix-blend-color"
        style={{ background: `linear-gradient(160deg, ${accent}cc, transparent 65%)` }}
      />
      <div className="absolute inset-0 bg-gradient-to-t from-ink-950/80 via-transparent to-transparent" />
    </div>
  );
}
