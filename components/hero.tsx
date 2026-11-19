import { AduScene } from "@/components/adu-scene";
import { Eyebrow } from "@/components/eyebrow";

/** Full-bleed 3D hero: headline in the sky, the client's lot below. `children` is the address form that starts the funnel. */
export function Hero({ children }: { children: React.ReactNode }) {
  return (
    <section id="start" className="px-3 pt-3 sm:px-4" aria-labelledby="hero-heading">
      <div className="relative isolate mx-auto flex min-h-[max(680px,min(calc(100svh_-_5rem),940px))] max-w-[1400px] flex-col overflow-hidden rounded-2xl bg-[linear-gradient(180deg,#c9d6df_0%,#e4e2da_55%,#efe3d0_100%)]">
        <AduScene />
        <div
          className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_bottom,rgba(251,248,243,0.97)_0%,rgba(251,248,243,0.9)_36%,rgba(251,248,243,0.55)_48%,rgba(251,248,243,0)_64%)]"
          aria-hidden="true"
        />
        <div className="relative z-10 mx-auto flex w-full max-w-4xl flex-col items-center px-5 pb-80 pt-12 text-center sm:pb-0 sm:pt-20">
          <Eyebrow>
            <span className="hidden sm:inline">Los Angeles · </span>ADU investment analysis
          </Eyebrow>
          <h1
            id="hero-heading"
            className="mt-6 font-display text-[2.6rem] leading-[1.02] text-ink sm:text-6xl lg:text-7xl"
          >
            See what an ADU would <span className="text-pine">return</span> on your property
          </h1>
          <p className="mt-5 max-w-xl text-base leading-7 text-ink-soft sm:text-lg">
            Enter your address. We pull your property records, price the build, and model the rent in a free ROI report you can
            download.
          </p>
          <div className="mt-8 w-full max-w-2xl">{children}</div>
        </div>
      </div>
    </section>
  );
}
