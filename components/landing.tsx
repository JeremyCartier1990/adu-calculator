import Image, { type StaticImageData } from "next/image";
import { ArrowBox, Eyebrow } from "@/components/eyebrow";
import { BRAND } from "@/lib/brand";
import blackCabin from "@/public/adus/black-cabin.jpg";
import cedarDeck from "@/public/adus/cedar-deck.jpg";
import oakCottage from "@/public/adus/oak-cottage.jpg";
import stuccoFlatRoof from "@/public/adus/stucco-flat-roof.jpg";
import whiteModern from "@/public/adus/white-modern.jpg";

const STEPS = [
  { title: "Enter your address", text: "We pull public records for the home: size, lot, bedrooms, and an estimated value." },
  { title: "Confirm the details", text: "Correct anything that's off. Better inputs, better numbers." },
  { title: "Get your ROI report", text: "Pick an ADU type and size. Your report updates live, and you can download it as a PDF." },
];

const METRICS = [
  {
    title: "All-in build cost",
    text: "Every line from plans to final inspection, priced at current Los Angeles rates for your ADU type and finish.",
    tags: ["Construction", "Architectural plans", "City permits"],
  },
  {
    title: "Rent from real comps",
    text: "Long-term rent from nearby rental comps for an ADU of your size, and short-term nightly rates for your market.",
    tags: ["Long-term lease", "Short-term rental", "Occupancy", "Operating costs"],
  },
  {
    title: "Return & payback",
    text: "Year-one net income, cash-on-cash return, and a 15-year cumulative cash-flow curve with rent growth.",
    tags: ["Net income / month", "Cash-on-cash", "Payback", "15-year cash flow"],
  },
  {
    title: "Added home value",
    text: "What the new square footage and its income may add to your home's value, against what it costs to build.",
    tags: ["Value added", "New home value", "Equity created"],
  },
];

const FAQ = [
  {
    q: "Is it free?",
    a: "Yes. The report is free and there's no obligation to build.",
  },
  {
    q: "How accurate is it?",
    a: "It's a planning estimate, not a bid. Build costs come from current Los Angeles rates by ADU type and finish; rent comes from comps when the address matches public records. A site visit and plans set the real price.",
  },
  {
    q: "Why do you ask for my phone number?",
    a: "We text a one-time code so each report belongs to a real homeowner. A builder may follow up about your project; you can say no anytime.",
  },
  {
    q: "Can I short-term rent an ADU in Los Angeles?",
    a: "Often not without limits. LA's home-sharing ordinance restricts registration, primary-residence use, and nights. The report shows both scenarios so you can compare; check the rules for your address.",
  },
];

export function HowItWorks() {
  return (
    <section id="how" className="mx-auto max-w-[1400px] scroll-mt-20 px-4 py-20 sm:px-6 md:py-28" aria-labelledby="how-heading">
      <Eyebrow>How it works</Eyebrow>
      <h2 id="how-heading" className="mt-5 max-w-3xl font-display text-4xl leading-[1.05] sm:text-5xl">
        Three steps. <span className="text-ink-soft">Two minutes.</span>
      </h2>
      <ol className="mt-12 grid border-t border-line sm:grid-cols-3">
        {STEPS.map((step, index) => (
          <li key={step.title} className="border-b border-line py-8 sm:border-b-0 sm:pr-8 sm:[&:not(:first-child)]:border-l sm:[&:not(:first-child)]:pl-8">
            <span className="text-sm font-medium tabular-nums text-ink-soft">0{index + 1}</span>
            <h3 className="mt-10 font-display text-2xl">{step.title}</h3>
            <p className="mt-3 max-w-sm text-sm leading-6 text-ink-soft">{step.text}</p>
          </li>
        ))}
      </ol>
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
          <Eyebrow>ADU designs</Eyebrow>
          <h2 id="designs-heading" className="mt-5 max-w-2xl font-display text-4xl leading-[1.05] sm:text-5xl">
            Built for California backyards
          </h2>
        </div>
        <p className="max-w-sm text-sm leading-6 text-ink-soft">
          Detached units, studios, and garden cottages. Pick a type in your report to see what it costs and what it earns.
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

export function ReportContents() {
  return (
    <section id="report" className="scroll-mt-20 px-3 sm:px-4" aria-labelledby="report-heading">
      <div className="mx-auto max-w-[1400px] rounded-2xl bg-ink px-5 py-20 text-white sm:px-10 md:py-28 lg:px-14">
        <Eyebrow tone="dark">What&apos;s in your report</Eyebrow>
        <h2 id="report-heading" className="mt-5 max-w-3xl font-display text-4xl leading-[1.05] sm:text-5xl">
          Every number you need before you call a builder
        </h2>
        <ul className="mt-14 border-t border-white/15">
          {METRICS.map((metric) => (
            <li key={metric.title} className="grid gap-5 border-b border-white/15 py-9 lg:grid-cols-[1fr_1.4fr] lg:gap-12">
              <h3 className="font-display text-2xl">{metric.title}</h3>
              <div>
                <p className="max-w-xl text-base leading-7 text-white/70">{metric.text}</p>
                <ul className="mt-5 flex flex-wrap gap-2" aria-label={`${metric.title} includes`}>
                  {metric.tags.map((tag) => (
                    <li key={tag} className="rounded-md bg-white/10 px-3 py-1.5 text-sm text-white/90">
                      {tag}
                    </li>
                  ))}
                </ul>
              </div>
            </li>
          ))}
        </ul>
        <a href="#start" className="mt-12 inline-flex items-center gap-3 rounded-lg bg-white py-1.5 pl-1.5 pr-5 text-base font-medium text-ink hover:bg-paper">
          <ArrowBox tone="light" />
          Start with your address
        </a>
      </div>
    </section>
  );
}

export function Faq() {
  return (
    <section id="faq" className="mx-auto max-w-[1400px] scroll-mt-20 px-4 py-20 sm:px-6 md:py-28" aria-labelledby="faq-heading">
      <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr]">
        <div>
          <Eyebrow>FAQ</Eyebrow>
          <h2 id="faq-heading" className="mt-5 font-display text-4xl leading-[1.05] sm:text-5xl">
            Questions, answered
          </h2>
        </div>
        <div className="divide-y divide-line border-y border-line">
          {FAQ.map((item) => (
            <details key={item.q} className="group py-6">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-6 text-lg font-medium tracking-tight">
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
      <div className="mx-auto flex max-w-[1400px] flex-col items-center rounded-2xl bg-ink px-6 py-20 text-center text-white sm:py-28">
        <Eyebrow tone="dark">Free · About 2 minutes</Eyebrow>
        <h2 id="cta-heading" className="mx-auto mt-6 max-w-3xl font-display text-4xl leading-[1.05] sm:text-6xl">
          Know your ADU&apos;s return before you build
        </h2>
        <a href="#start" className="mt-10 inline-flex items-center gap-3 rounded-lg bg-white py-1.5 pl-1.5 pr-6 text-base font-medium text-ink hover:bg-paper">
          <ArrowBox tone="light" />
          Get my free ROI report
        </a>
      </div>
    </section>
  );
}
