import { AduScene } from "@/components/adu-scene";

const highlights = [
  { value: "Build cost", label: "Construction, plans, permits, and fees for your ADU type" },
  { value: "Rent, two ways", label: "Long-term lease and short-term rental, side by side" },
  { value: "ROI & value", label: "Cash flow, payback, and the value it adds to your home" },
];

/** Full-bleed 3D hero. `children` is the address form that starts the funnel. */
export function Hero({ children }: { children: React.ReactNode }) {
  return (
    <section id="start" className="px-3 pt-3 sm:px-4" aria-labelledby="hero-heading">
      <div className="relative isolate mx-auto flex min-h-[max(640px,min(calc(100svh_-_5rem),920px))] max-w-[1400px] flex-col justify-end overflow-hidden rounded-[28px] bg-[linear-gradient(180deg,#7d97ad_0%,#b9b3a3_48%,#e8c39a_100%)]">
        <AduScene />
        <div
          className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_top,rgba(12,13,12,0.9)_0%,rgba(12,13,12,0.72)_52%,rgba(12,13,12,0)_80%)] lg:bg-[linear-gradient(to_top,rgba(12,13,12,0.82)_0%,rgba(12,13,12,0.2)_48%,rgba(12,13,12,0)_72%),linear-gradient(to_right,rgba(12,13,12,0.6)_0%,rgba(12,13,12,0)_58%)]"
          aria-hidden="true"
        />
        <div className="relative z-10 px-5 pb-6 pt-40 sm:px-10 sm:pb-8 lg:px-14 lg:pb-10">
          <p className="text-xs font-medium uppercase tracking-[0.2em] text-white/70">Los Angeles · ADU investment analysis</p>
          <h1
            id="hero-heading"
            className="mt-4 max-w-3xl font-serif text-[2.9rem] leading-[1] tracking-tight text-white sm:text-6xl lg:text-7xl xl:text-[5.5rem]"
          >
            See what an ADU would <em className="italic text-[#9fe0d8]">return</em> on your property.
          </h1>
          <p className="mt-5 max-w-lg text-base leading-7 text-white/80 sm:text-lg">
            Enter your address. We pull your property records, price the build, and model the rent, in a free ROI report you can
            download.
          </p>
          <div className="mt-7 max-w-xl">{children}</div>
          <dl className="mt-10 hidden gap-8 border-t border-white/15 pt-6 sm:grid sm:grid-cols-3">
            {highlights.map((item) => (
              <div key={item.value}>
                <dt className="text-sm font-medium text-white">{item.value}</dt>
                <dd className="mt-1 text-sm leading-6 text-white/60">{item.label}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>
    </section>
  );
}
