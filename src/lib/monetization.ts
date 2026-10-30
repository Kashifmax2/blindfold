/**
 * Monetization (ProfitOn) — every ad setting lives in this one file.
 *
 * Turn EVERYTHING off without touching code:
 *   Vercel → Settings → Environment Variables → NEXT_PUBLIC_MONETIZATION = off
 *   (then redeploy)
 *
 * Turn it off by code (permanently):
 *   delete `src/components/site/ads.tsx` + `src/lib/monetization.ts`
 *   and remove the two <AdSlots /> / <SponsoredLink /> lines from `src/app/layout.tsx`.
 */

export type AdScript = {
  /** Stable id, also used as the DOM key. */
  key: string;
  /** Script URL — must be absolute https so it works behind proxies. */
  src: string;
  /** ProfitOn zone id, for reference when reporting problems. */
  zone: string;
  /** Seconds to wait after page load before asking for the script. */
  delay: number;
};

export const MONETIZATION = {
  /** Set NEXT_PUBLIC_MONETIZATION=off to disable every ad instantly. */
  enabled: (process.env.NEXT_PUBLIC_MONETIZATION ?? "on").toLowerCase() !== "off",

  /** ProfitOn "Pops" — popunder. */
  pops: {
    key: "pops",
    src: "https://oc.parergygrates.com/r84RGTrpOMVW/160006",
    zone: "160006",
    delay: 1,
  } satisfies AdScript,

  /** ProfitOn "Shuffle box". */
  shuffleBox: {
    key: "shuffle-box",
    src: "https://lv.safflorfaring.com/s609xEgmUOhJpYc/160007",
    zone: "160007",
    delay: 2,
  } satisfies AdScript,

  /** ProfitOn "Smartlink" — also used for the first-click popunder. */
  smartlink: {
    url: "https://pu.koklasfiliate.com/iwfX6hN4cDbm/160005",
    zone: "160005",
    /** Minimum gap between two automatic opens, per browser session. */
    cooldownMs: 10 * 60 * 1000,
  },

  /** Ads are never loaded inside the admin console. */
  blockedPaths: ["/admin"],

  /** One flag to silence the first-click popunder but keep the scripts. */
  firstClickPopunder: true,
} as const;

export type Monetization = typeof MONETIZATION;
