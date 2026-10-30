"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { MONETIZATION, type AdScript } from "@/lib/monetization";
import { ArrowIcon } from "./icons";

const POP_KEY = "blndfld:ad-pop";

/** Loads one ProfitOn script after the page is usable. */
function useAdScript(script: AdScript, enabled: boolean) {
  useEffect(() => {
    if (!enabled) return;
    const id = `ad-script-${script.key}`;
    if (document.getElementById(id)) return;

    const timer = window.setTimeout(() => {
      if (document.getElementById(id)) return;
      const el = document.createElement("script");
      el.id = id;
      el.src = script.src;
      el.async = true;
      el.setAttribute("data-cfasync", "false");
      document.body.appendChild(el);
    }, script.delay * 1000);

    return () => window.clearTimeout(timer);
  }, [enabled, script]);
}

/**
 * Ad layer: ProfitOn pops + shuffle box, plus a first-click popunder to the
 * smartlink.
 *
 * Remove me = delete this file, delete `src/lib/monetization.ts`, drop the two
 * lines from `src/app/layout.tsx`. Or set NEXT_PUBLIC_MONETIZATION=off.
 */
export function AdSlots() {
  const pathname = usePathname();
  const enabled =
    MONETIZATION.enabled &&
    !MONETIZATION.blockedPaths.some((p) => pathname?.startsWith(p));

  useAdScript(MONETIZATION.pops, enabled);
  useAdScript(MONETIZATION.shuffleBox, enabled);

  useEffect(() => {
    if (!enabled || !MONETIZATION.firstClickPopunder) return;

    const onClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement | null;
      // The visible sponsored link opens itself — don't double-open.
      if (target?.closest("[data-ad-link]")) return;

      try {
        const last = Number(window.sessionStorage.getItem(POP_KEY) ?? 0);
        if (Date.now() - last < MONETIZATION.smartlink.cooldownMs) return;
        window.sessionStorage.setItem(POP_KEY, String(Date.now()));
      } catch {
        // Private mode / blocked storage: fall through and open anyway.
      }

      window.open(MONETIZATION.smartlink.url, "_blank", "noopener,noreferrer");
    };

    window.addEventListener("click", onClick, { capture: true });
    return () => window.removeEventListener("click", onClick, { capture: true });
  }, [enabled]);

  return null;
}

/** Small, clearly labelled sponsor link. Opens the smartlink in a new tab. */
export function SponsoredLink({ className = "" }: { className?: string }) {
  if (!MONETIZATION.enabled) return null;

  return (
    <a
      data-ad-link
      href={MONETIZATION.smartlink.url}
      target="_blank"
      rel="sponsored noopener noreferrer"
      className={`group inline-flex items-center gap-1.5 rounded-full border border-white/10 px-3 py-1.5 text-[10px] font-semibold tracking-[0.18em] text-mist-500 uppercase transition hover:border-veil-400/40 hover:text-veil-200 ${className}`}
      title="Sponsored partner link"
    >
      Sponsored
      <ArrowIcon width={11} height={11} className="transition group-hover:translate-x-0.5" />
    </a>
  );
}
