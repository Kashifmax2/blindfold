"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { CloseIcon, MenuIcon, ShieldIcon } from "./icons";

const LINKS = [
  { href: "/#vault", label: "👑 My Vault" },
  { href: "/#library", label: "Library" },
  { href: "/#stage", label: "Visualizer" },
  { href: "/#system", label: "System" },
];

export function SiteHeader({ admin = false }: { admin?: boolean }) {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header className="fixed inset-x-0 top-0 z-40 px-3 py-3 sm:px-6">
      <div
        className={`mx-auto flex max-w-6xl items-center justify-between gap-4 rounded-2xl px-4 py-2.5 transition-all duration-300 sm:px-6 ${
          scrolled
            ? "glass-strong border border-veil-400/25 bg-ink-950/90 shadow-2xl backdrop-blur-2xl"
            : "glass border border-veil-400/15 bg-ink-950/75 backdrop-blur-xl"
        }`}
      >
        <Link href="/" className="group flex items-center gap-3">
          <span className="relative block h-10 w-10 shrink-0 sm:h-11 sm:w-11">
            <span
              className="absolute -inset-1 rounded-full opacity-70 blur-md transition group-hover:opacity-100"
              style={{
                background: "var(--accent)",
                opacity: "calc(0.35 + var(--audio-level) * 0.65)",
              }}
            />
            <Image
              src="/brand/logo.png"
              alt="BLINDFOLD logo"
              width={88}
              height={88}
              priority
              className="relative h-10 w-10 rounded-full object-cover ring-1 ring-veil-400/40 transition duration-500 group-hover:rotate-6 group-hover:ring-veil-400 sm:h-11 sm:w-11"
            />
          </span>
          <span className="leading-tight">
            <span className="block font-display text-sm font-bold tracking-[0.24em] text-mist-200 uppercase sm:text-[15px]">
              Blindfold
            </span>
            <span className="block text-[9px] tracking-[0.28em] text-veil-400/90 uppercase sm:text-[10px]">
              sound system
            </span>
          </span>
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="relative rounded-full px-4 py-2 text-xs font-semibold tracking-wider text-mist-400 transition hover:text-mist-200"
            >
              <span className="relative z-10">{link.label}</span>
              <span className="absolute inset-0 scale-90 rounded-full bg-white/0 opacity-0 transition-all duration-300 hover:bg-white/5 hover:opacity-100" />
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <Link
            href={admin ? "/" : "/admin"}
            className="group inline-flex items-center gap-2 rounded-full border border-veil-400/35 bg-veil-400/15 px-3.5 py-1.5 text-xs font-medium tracking-[0.16em] text-veil-200 uppercase transition hover:border-veil-400/80 hover:bg-veil-400/25 sm:px-4 sm:py-2"
          >
            <ShieldIcon width={14} height={14} className="transition group-hover:scale-110" />
            <span>{admin ? "Exit" : "Admin"}</span>
          </Link>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            aria-label="Menu"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-white/10 text-mist-300 transition hover:border-veil-400/50 hover:text-veil-200 md:hidden"
          >
            {open ? <CloseIcon width={16} height={16} /> : <MenuIcon width={16} height={16} />}
          </button>
        </div>
      </div>

      {open ? (
        <div className="glass-strong mx-auto mt-2 flex max-w-6xl flex-col gap-1 rounded-2xl border border-veil-400/20 bg-ink-950/95 p-3 backdrop-blur-2xl md:hidden">
          {LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setOpen(false)}
              className="rounded-xl px-4 py-3 text-sm text-mist-300 transition hover:bg-white/5 hover:text-veil-200"
            >
              {link.label}
            </Link>
          ))}
          <Link
            href={admin ? "/" : "/admin"}
            onClick={() => setOpen(false)}
            className="rounded-xl bg-veil-400/20 px-4 py-3 text-sm font-semibold text-veil-200 transition hover:bg-veil-400/30"
          >
            {admin ? "← Return to Player" : "Open Admin Console"}
          </Link>
        </div>
      ) : null}
    </header>
  );
}
