import Link from "next/link";
import { SponsoredLink } from "./ads";
import { ArrowLeftIcon, ArrowRightIcon, BoltIcon, ShieldIcon, UploadIcon, WaveIcon } from "./icons";
import { Reveal, SectionLabel } from "./ui";

const FEATURES = [
  {
    icon: WaveIcon,
    title: "Glass spectrum rails",
    body: "Two frosted columns run the full height of the page on both edges. Each hit sends a beam shooting inward — beep in, line out, all the way down to the corners.",
    accent: "#35e0ff",
  },
  {
    icon: BoltIcon,
    title: "Transient beat engine",
    body: "A hybrid onset detector reads low-band punch and spectral flux together, so kicks and hooks both fire the beams, shock rings and room flash on the very same frame.",
    accent: "#7c5cff",
  },
  {
    icon: UploadIcon,
    title: "Console uploads",
    body: "Drop an MP3, WAV or OGG in the admin console, tag the mood, pick an accent colour and it lands in the public rotation instantly.",
    accent: "#ff4fd8",
  },
  {
    icon: ShieldIcon,
    title: "Range-aware streaming",
    body: "Audio is served from the app with byte-range support, so scrubbing is instant and the analyser never hits a cross-origin wall.",
    accent: "#4dffc3",
  },
];

export function SystemSection() {
  return (
    <section id="system" className="relative z-10 scroll-mt-28 py-16 sm:py-20">
      <div className="mx-auto max-w-6xl px-5">
        <Reveal className="max-w-2xl">
          <SectionLabel>The system</SectionLabel>
          <h2 className="mt-4 font-display text-[clamp(1.9rem,4.4vw,2.9rem)] leading-tight font-bold tracking-[-0.02em] text-mist-200">
            Built for people who listen with the lights off.
          </h2>
        </Reveal>

        <div className="mt-10 grid gap-5 md:grid-cols-2">
          {FEATURES.map((feature, i) => (
            <Reveal as="article" key={feature.title} delay={i * 80}>
              <div className="group glass relative h-full overflow-hidden rounded-3xl p-6 transition duration-500 hover:-translate-y-1.5 sm:p-7">
                <div
                  className="pointer-events-none absolute -top-24 -right-16 h-52 w-52 rounded-full opacity-0 blur-3xl transition duration-700 group-hover:opacity-70"
                  style={{ background: feature.accent }}
                />
                <span
                  className="relative flex h-11 w-11 items-center justify-center rounded-2xl text-ink-950 transition duration-500 group-hover:scale-110"
                  style={{
                    background: `linear-gradient(140deg, #eafbff, ${feature.accent})`,
                    boxShadow: `0 14px 36px -18px ${feature.accent}`,
                  }}
                >
                  <feature.icon width={19} height={19} />
                </span>
                <h3 className="relative mt-5 font-display text-lg font-semibold text-mist-200">
                  {feature.title}
                </h3>
                <p className="relative mt-3 text-sm leading-relaxed text-mist-400">{feature.body}</p>
              </div>
            </Reveal>
          ))}
        </div>

        <Reveal delay={120} className="mt-8">
          <div className="glass flex flex-col items-start justify-between gap-5 rounded-3xl p-7 sm:flex-row sm:items-center">
            <div>
              <h3 className="font-display text-xl font-semibold text-mist-200">
                Running the decks tonight?
              </h3>
              <p className="mt-2 max-w-lg text-sm text-mist-400">
                The admin console handles uploads, artwork accents, featured slots and clean
                deletes — no rebuild required.
              </p>
            </div>
            <Link
              href="/admin"
              className="group inline-flex items-center gap-2 rounded-full px-6 py-3.5 font-display text-sm font-semibold tracking-[0.14em] text-ink-950 uppercase transition hover:scale-[1.03]"
              style={{
                background: "linear-gradient(120deg, #eafbff, var(--accent) 70%, #7c5cff 150%)",
                boxShadow: "0 16px 45px -20px color-mix(in oklab, var(--accent) 90%, transparent)",
              }}
            >
              Open admin console
            </Link>
          </div>
        </Reveal>
      </div>
    </section>
  );
}

export function SiteFooter() {
  return (
    <footer className="relative z-10 mt-10 border-t border-white/8 pt-10 pb-44">
      <div className="mx-auto flex max-w-6xl flex-col gap-8 px-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-display text-sm tracking-[0.28em] text-mist-300 uppercase">
            Blindfold Sound System
          </p>
          <p className="mt-2 max-w-sm text-xs leading-relaxed text-mist-500">
            Demo tracks are procedurally synthesised in-house — no external streaming services,
            no trackers, just waveform math.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-mist-500">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 px-3 py-1.5">
            <kbd className="font-mono text-[10px] tracking-wide text-mist-300">Space</kbd>
            <span className="text-mist-400">play/pause</span>
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 px-3 py-1.5">
            <kbd className="font-mono text-[10px] tracking-wide text-mist-300">Shift</kbd>
            <ArrowLeftIcon width={11} height={11} className="text-mist-300" />
            <ArrowRightIcon width={11} height={11} className="text-mist-300" />
            <span className="text-mist-400">skip</span>
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/10 px-3 py-1.5">
            <kbd className="font-mono text-[10px] tracking-wide text-mist-300">M</kbd>
            <span className="text-mist-400">mute</span>
          </span>
        </div>
      </div>
      <div className="mx-auto mt-8 flex max-w-6xl flex-wrap items-center gap-4 px-5">
        <p className="text-[11px] tracking-[0.2em] text-mist-500/70 uppercase">
          © {new Date().getFullYear()} Blindfold — eyes closed, volume up.
        </p>
        <SponsoredLink className="ml-auto" />
      </div>
    </footer>
  );
}
