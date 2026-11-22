import Image, { type StaticImageData } from "next/image";
import { ArrowBox, Eyebrow } from "@/components/eyebrow";
import { InvestmentSummary, projectPhrase } from "@/components/report/investment-summary";
import { BRAND } from "@/lib/brand";
import { formatMoney, formatMoneyCompact } from "@/lib/money";
import { SAMPLE_PROPERTY, sampleReport } from "@/lib/sample-report";
import blackCabin from "@/public/adus/black-cabin.jpg";
import cedarDeck from "@/public/adus/cedar-deck.jpg";
import oakCottage from "@/public/adus/oak-cottage.jpg";
import stuccoFlatRoof from "@/public/adus/stucco-flat-roof.jpg";
import whiteModern from "@/public/adus/white-modern.jpg";

/** Every primary call to action on the page goes back to the address field. */
function StartButton({ children, tone = "dark" }: { children: React.ReactNode; tone?: "dark" | "light" }) {
  const dark = tone === "dark";
  return (
    <a
      href="#start"
      className={`inline-flex min-h-12 w-full items-center justify-center gap-3 rounded-lg py-1.5 pl-1.5 pr-5 text-base font-semibold sm:w-auto ${
        dark ? "bg-ink text-white hover:bg-ink/85" : "bg-white text-ink hover:bg-paper"
      }`}
    >
      <ArrowBox tone={dark ? "dark" : "light"} />
      {children}
    </a>
  );
}

/** Floats over the hero's lot: the three numbers a report leads with, for the sample home. */
export function HeroPreview() {
  const { estimate, summary } = sampleReport();
  const rows: Array<[string, string, string]> = [
    ["You invest", formatMoneyCompact(summary.invest), "text-white"],
    ["Home gains", `+${formatMoneyCompact(summary.valueAdded)}`, "text-[#7fd6a8]"],
    ["You keep monthly", formatMoney(summary.longTerm), "text-[#7fd6a8]"],
  ];
  return (
    <div className="rounded-xl bg-ink/90 p-4 text-left text-white shadow-[0_24px_60px_rgba(12,13,12,0.35)] backdrop-blur-md">
      <p className="text-[11px] text-white/60">
        <span className="font-semibold uppercase tracking-[0.12em]">Sample report</span> · {projectPhrase(estimate)}, Los Angeles
      </p>
      <dl className="mt-3 grid grid-cols-3 gap-2">
        {rows.map(([label, value, tone]) => (
          <div key={label} className="min-w-0 rounded-lg bg-white/[0.07] px-2.5 py-2">
            <dt className="text-[11px] leading-4 text-white/60">{label}</dt>
            <dd className={`mt-1 truncate font-display text-base tabular-nums sm:text-lg ${tone}`}>{value}</dd>
          </div>
        ))}
      </dl>
      <p className="mt-2.5 text-xs text-white/60">Yours uses your address, your home&apos;s records, and rent near you.</p>
    </div>
  );
}

const SOURCES = [
  { title: "Property records", text: "Home size, lot, beds, baths, and value for your address" },
  { title: "Rent comps", text: "Long-term rent for an ADU near you, from RentCast" },
  { title: "Short-term data", text: "Nightly rates and occupancy nearby, from AirROI" },
  { title: "Mortgage rates", text: "This week's Freddie Mac average, to price a refinance" },
  { title: "California ADU rules", text: "The largest unit the state lets you build on your lot" },
];

/** Where the numbers come from, so the report reads as data, not a sales pitch. */
export function DataSources() {
  return (
    <section className="mx-auto max-w-[1400px] px-4 pb-16 sm:px-6 md:pb-24" aria-labelledby="sources-heading">
      <div className="rounded-2xl border border-line bg-surface p-5 sm:p-8">
        <h2 id="sources-heading" className="font-display text-2xl leading-tight sm:text-3xl">
          Built from real data on your address
        </h2>
        <ul className="mt-5 grid gap-x-8 gap-y-4 sm:grid-cols-2 lg:grid-cols-5">
          {SOURCES.map((source) => (
            <li key={source.title} className="flex gap-3 lg:block">
              <Check className="mt-1 text-pine lg:mt-0" />
              <div className="lg:mt-3">
                <p className="text-sm font-semibold text-ink">{source.title}</p>
                <p className="mt-0.5 text-sm leading-5 text-ink-soft">{source.text}</p>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export function Check({ className = "text-pine" }: { className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={`h-4 w-4 shrink-0 ${className}`} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3.5 8.5l3 3 6-7" />
    </svg>
  );
}

const INSIDE = [
  { title: "The best setup for your lot", text: "A size that fits your lot, on the ADU type with the best 10-year return." },
  { title: "What it costs, line by line", text: "Construction, architectural plans, and city permits at current rates for your finish." },
  { title: "What it adds to your home", text: "Your home's value before and after, and how much more it's worth than it costs." },
  { title: "Rent: lease vs. short-term", text: "Monthly rent, nightly rate, occupancy, and what each leaves you after expenses." },
  { title: "How to pay for it", text: "Cash, a cash-out refinance, a loan, or a mix, and what you keep after every payment." },
  { title: "15-year cash flow and payback", text: "Year-by-year income with rent growth, cash-on-cash return, and the year it pays for itself." },
];

/** The report's own answer for a sample home, then what else is inside. */
export function SampleReport() {
  const { estimate, summary } = sampleReport();
  return (
    <section id="report" className="scroll-mt-20 px-3 pt-16 sm:px-4 md:pt-24" aria-labelledby="report-heading">
      <div className="mx-auto max-w-[1400px]">
        <div className="px-1 sm:px-2">
          <Eyebrow>What you get</Eyebrow>
          <h2 id="report-heading" className="mt-5 max-w-3xl font-display text-4xl leading-[1.05] sm:text-5xl">
            The answer first. <span className="text-ink-soft">Then every number behind it.</span>
          </h2>
          <p className="mt-4 max-w-2xl text-base leading-7 text-ink-soft">
            This is the top of a real report, run on a sample home. Yours uses your address, your home&apos;s records, and rent near you.
          </p>
        </div>

        <div className="mt-8 overflow-hidden rounded-2xl bg-ink">
          <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 px-5 py-3 sm:px-8">
            <p className="text-xs text-white/60">{SAMPLE_PROPERTY.label}</p>
            <span className="rounded bg-white/10 px-2 py-0.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-white/70">Sample report</span>
          </div>
          <div className="p-5 sm:p-8 lg:p-10">
            <InvestmentSummary estimate={estimate} summary={summary} />
          </div>
        </div>

        <div className="mt-10 grid gap-8 lg:grid-cols-[0.8fr_1.2fr] lg:gap-14">
          <div className="px-1 sm:px-2">
            <h3 className="font-display text-3xl leading-tight">Also in your report</h3>
            <p className="mt-3 max-w-md text-base leading-7 text-ink-soft">
              Change any number and the whole report updates. Download it as a PDF to share with your family, your lender, or a builder.
            </p>
            <div className="mt-6 hidden lg:block">
              <StartButton>Get this for my address</StartButton>
            </div>
          </div>
          <ul className="grid gap-2 sm:grid-cols-2">
            {INSIDE.map((item, index) => (
              <li key={item.title} className="rounded-xl border border-line bg-surface p-5">
                <span className="text-xs font-semibold tabular-nums text-ink-soft">0{index + 1}</span>
                <h4 className="mt-2 text-base font-semibold text-ink">{item.title}</h4>
                <p className="mt-1.5 text-sm leading-6 text-ink-soft">{item.text}</p>
              </li>
            ))}
            <li className="rounded-xl border border-line bg-surface p-5 sm:col-span-2">
              <h4 className="flex items-center gap-2 text-base font-semibold text-ink">
                <Check />
                Plus: a satellite site plan and a downloadable PDF
              </h4>
              <p className="mt-1.5 text-sm leading-6 text-ink-soft">
                Draw the ADU on your own lot from above, and keep a private link that always shows your latest numbers.
              </p>
            </li>
          </ul>
          <div className="lg:hidden">
            <StartButton>Get this for my address</StartButton>
          </div>
        </div>
      </div>
    </section>
  );
}

const STEPS = [
  { title: "Enter your address", text: "We look up your home's public records: size, lot, bedrooms, and estimated value." },
  { title: "Check your home's details", text: "One tap if they look right. Fix anything that's off; better inputs, better numbers." },
  { title: "Open your report", text: "Confirm your phone with a quick text code and your report opens right away, with a PDF to keep." },
];

export function HowItWorks() {
  return (
    <section id="how" className="mx-auto max-w-[1400px] scroll-mt-20 px-4 py-16 sm:px-6 md:py-24" aria-labelledby="how-heading">
      <Eyebrow>How it works</Eyebrow>
      <h2 id="how-heading" className="mt-5 max-w-3xl font-display text-4xl leading-[1.05] sm:text-5xl">
        Three steps. <span className="text-ink-soft">About a minute.</span>
      </h2>
      <ol className="mt-10 grid border-t border-line sm:grid-cols-3">
        {STEPS.map((step, index) => (
          <li key={step.title} className="border-b border-line py-7 sm:border-b-0 sm:pr-8 sm:[&:not(:first-child)]:border-l sm:[&:not(:first-child)]:pl-8">
            <span className="grid h-8 w-8 place-items-center rounded-full bg-ink text-sm font-semibold tabular-nums text-white">{index + 1}</span>
            <h3 className="mt-5 font-display text-2xl sm:mt-8">{step.title}</h3>
            <p className="mt-2 max-w-sm text-base leading-7 text-ink-soft">{step.text}</p>
          </li>
        ))}
      </ol>
      <div className="mt-8">
        <StartButton>Start with my address</StartButton>
      </div>
    </section>
  );
}

// Unsplash photos, for design inspiration; credit each photographer.
const DESIGNS: Array<{ image: StaticImageData; title: string; text: string; alt: string; credit: string }> = [
  {
    image: whiteModern,
    title: "Detached modern ADU",
    text: "Board-and-batten siding, deep eaves, and glass doors that open to the yard.",
    alt: "White modern backyard unit with board-and-batten siding, an oak front door, and potted olive trees",
    credit: "GoodLifeConstruction",
  },
  {
    image: stuccoFlatRoof,
    title: "Stucco flat roof",
    text: "Smooth stucco and a thin roofline: the classic Los Angeles backyard unit.",
    alt: "Cream stucco unit with a flat roof, black-framed windows, and a garden trellis",
    credit: "Kat Wallace",
  },
  {
    image: cedarDeck,
    title: "Cedar and deck",
    text: "Warm wood cladding with a deck and gravel garden for indoor-outdoor living.",
    alt: "Red cedar-clad unit with a wood deck, shade sail, and gravel garden",
    credit: "Patrick PETIT",
  },
  {
    image: oakCottage,
    title: "Garden cottage",
    text: "A dark, low cottage tucked under mature trees, lit warm at dusk.",
    alt: "Black modern cottage with lit windows under large oak trees",
    credit: "Jed Owen",
  },
  {
    image: blackCabin,
    title: "Backyard studio",
    text: "A compact gabled studio with solar on the roof, for an office or guest suite.",
    alt: "Black gabled backyard studio with solar panels and a small deck",
    credit: "Thomas Werneken",
  },
];

export function Designs() {
  const [feature, ...rest] = DESIGNS;
  return (
    <section id="designs" className="mx-auto max-w-[1400px] scroll-mt-20 px-4 pb-20 sm:px-6 md:pb-28" aria-labelledby="designs-heading">
      <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
        <div>
          <Eyebrow>Garage, attached, or backyard</Eyebrow>
          <h2 id="designs-heading" className="mt-5 max-w-2xl font-display text-4xl leading-[1.05] sm:text-5xl">
            Not sure which ADU? The report compares them.
          </h2>
        </div>
        <p className="max-w-sm text-base leading-7 text-ink-soft">
          It opens on a size that fits your lot and the ADU type with the best return. Switch to a garage conversion, an attached unit, or a different size
          and every number updates.
        </p>
      </div>
      <div className="mt-12 grid gap-3 lg:grid-cols-2">
        <DesignCard design={feature} large />
        <div className="grid gap-3 sm:grid-cols-2">
          {rest.map((design) => (
            <DesignCard key={design.title} design={design} />
          ))}
        </div>
      </div>
      <p className="mt-4 text-xs text-ink-soft">
        Design inspiration, not projects by {BRAND.builder}. Photos from Unsplash.
      </p>
    </section>
  );
}

function DesignCard({ design, large = false }: { design: (typeof DESIGNS)[number]; large?: boolean }) {
  return (
    <figure className="group relative overflow-hidden rounded-xl bg-paper-deep">
      <Image
        src={design.image}
        alt={design.alt}
        placeholder="blur"
        sizes={large ? "(min-width: 1024px) 50vw, 100vw" : "(min-width: 1024px) 25vw, (min-width: 640px) 50vw, 100vw"}
        className={`w-full object-cover transition duration-700 group-hover:scale-[1.03] ${large ? "aspect-[4/5] lg:h-full lg:aspect-auto" : "aspect-[4/3]"}`}
      />
      <figcaption className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-ink/80 via-ink/35 to-transparent p-5 pt-16 text-white">
        <span className="block font-display text-xl">{design.title}</span>
        <span className={`mt-1 block max-w-md text-sm leading-6 text-white/80 ${large ? "" : "sr-only sm:not-sr-only sm:line-clamp-2"}`}>{design.text}</span>
        <span className="mt-2 block text-[11px] text-white/55">Photo: {design.credit} / Unsplash</span>
      </figcaption>
    </figure>
  );
}

const FAQ = [
  {
    q: "Is it really free?",
    a: "Yes. The report and the PDF are free, there's nothing to buy, and there's no obligation to build.",
  },
  {
    q: "What do I need to get started?",
    a: "Just your address. We fill in your home's details from public records; you only check them.",
  },
  {
    q: "Why do you ask for my phone number?",
    a: `We text a one-time code so each report belongs to a real homeowner. ${BRAND.builder}, the builder behind the reports, may call to talk about your project; you can say no anytime.`,
  },
  {
    q: "How accurate is it?",
    a: "It's a planning estimate, not a bid. Build costs use current California rates by ADU type and finish, rent comes from comparable rentals near your address, and the value added follows how appraisers price square footage and rental income. A site visit and plans set the real price.",
  },
  {
    q: "Does it work for a garage conversion?",
    a: "Yes. Switch the ADU type to a garage conversion in your report, usually the lowest-cost option because the shell is already there, and compare it with an attached or backyard unit.",
  },
  {
    q: "Can I rent it short-term?",
    a: "It depends on your city. Many, including Los Angeles, limit short-term rentals of ADUs. The report shows both a 12-month lease and a short-term rental so you can compare; check the rules for your address.",
  },
];

export function Faq() {
  return (
    <section id="faq" className="mx-auto max-w-[1400px] scroll-mt-20 px-4 py-16 sm:px-6 md:py-24" aria-labelledby="faq-heading">
      <div className="grid gap-8 lg:grid-cols-[0.8fr_1.2fr] lg:gap-10">
        <div>
          <Eyebrow>FAQ</Eyebrow>
          <h2 id="faq-heading" className="mt-5 font-display text-4xl leading-[1.05] sm:text-5xl">
            Questions, answered
          </h2>
        </div>
        <div className="divide-y divide-line border-y border-line">
          {FAQ.map((item) => (
            <details key={item.q} className="group py-5">
              <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-6 text-lg font-medium tracking-tight">
                {item.q}
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-md bg-ink/[0.06] text-lg text-ink transition group-open:rotate-45" aria-hidden="true">
                  +
                </span>
              </summary>
              <p className="mt-3 max-w-2xl text-base leading-7 text-ink-soft">{item.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}

export function FinalCta() {
  return (
    <section className="px-3 sm:px-4" aria-labelledby="cta-heading">
      <div className="mx-auto flex max-w-[1400px] flex-col items-center rounded-2xl bg-ink px-6 py-16 text-center text-white sm:py-24">
        <Eyebrow tone="dark">Free · About a minute · No obligation</Eyebrow>
        <h2 id="cta-heading" className="mx-auto mt-6 max-w-3xl font-display text-4xl leading-[1.05] sm:text-6xl">
          Know what an ADU is worth to you before you spend a dollar
        </h2>
        <ul className="mt-6 flex flex-col gap-2 text-left text-base text-white/80 sm:flex-row sm:gap-6">
          {["Cost to build", "Value it adds", "Rent after the loan"].map((item) => (
            <li key={item} className="flex items-center gap-2">
              <Check className="text-[#7fd6a8]" />
              {item}
            </li>
          ))}
        </ul>
        <div className="mt-9 w-full sm:w-auto">
          <StartButton tone="light">Get my free report</StartButton>
        </div>
      </div>
    </section>
  );
}
