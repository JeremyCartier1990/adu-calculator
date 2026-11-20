import { AduScene } from "@/components/adu-scene";
import { Eyebrow } from "@/components/eyebrow";

/** Full-bleed 3D hero: headline in the sky, the client's lot below. `children` is the address form that starts the funnel. */
export function Hero({ children }: { children: React.ReactNode }) {
  return (
    <section id="start" className="scroll-mt-20 px-3 pt-3 sm:px-4" aria-labelledby="hero-heading">
      <div className="relative isolate mx-auto flex min-h-[max(680px,min(calc(100svh_-_5rem),940px))] max-w-[1400px] flex-col overflow-hidden rounded-2xl bg-[linear-gradient(180deg,#c9d6df_0%,#e4e2da_55%,#efe3d0_100%)]">
        <AduScene />
        <div
          className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_bottom,rgba(251,248,243,0.97)_0%,rgba(251,248,243,0.9)_40%,rgba(251,248,243,0.55)_52%,rgba(251,248,243,0)_66%)]"
          aria-hidden="true"
        />
        <div className="relative z-10 mx-auto flex w-full max-w-4xl flex-col items-center px-5 pb-72 pt-10 text-center sm:pb-0 sm:pt-20">
          <Eyebrow>Free ADU ROI report</Eyebrow>
          <h1 id="hero-heading" className="mt-5 font-display text-[2.4rem] leading-[1.03] text-ink sm:mt-6 sm:text-6xl lg:text-7xl">
            What would an ADU <span className="text-pine">add</span> to your home?
          </h1>
          <p className="mt-4 max-w-xl text-base leading-7 text-ink-soft sm:mt-5 sm:text-lg">
            Enter your address. In about a minute, see what it costs to build, how much value it adds, and what it rents for after
            the loan payments.
          </p>
          <div className="mt-7 w-full max-w-2xl sm:mt-8">{children}</div>
        </div>
      </div>
    </section>
  );
}
