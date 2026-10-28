import { Hero, Marquee } from "@/components/home/hero";
import { HowItWorks } from "@/components/home/how-it-works";
import { Library } from "@/components/home/library";
import { Vault } from "@/components/home/vault";
import { StageCanvas } from "@/components/player/stage-canvas";
import { Stage } from "@/components/home/stage";
import { NowPlayingDock } from "@/components/player/now-playing-dock";
import { PlayerProvider } from "@/components/player/player-provider";
import { AmbientLayer, BeatFlash, RailPanels } from "@/components/player/visuals";
import { SiteHeader } from "@/components/site/site-header";
import { SiteFooter, SystemSection } from "@/components/site/system-section";
import { libraryStats, listSongs } from "@/lib/songs";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const [songs, stats] = await Promise.all([listSongs(), libraryStats()]);

  return (
    <PlayerProvider initialSongs={songs}>
      <AmbientLayer />
      <BeatFlash />
      <RailPanels />
      <StageCanvas />
      <SiteHeader />

      <main className="relative z-10 px-3 sm:px-7 lg:px-11 xl:px-[96px]">
        <Hero stats={stats} />
        <Marquee />
        <HowItWorks />
        <Vault />
        <Library />
        <Stage />
        <SystemSection />
      </main>

      <div className="relative z-10 px-3 sm:px-7 lg:px-11 xl:px-[96px]">
        <SiteFooter />
      </div>

      <NowPlayingDock />
    </PlayerProvider>
  );
}
