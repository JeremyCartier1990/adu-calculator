const STEPS = [
  { title: "Enter your address", text: "We pull public records for the home: size, lot, bedrooms, and an estimated value." },
  { title: "Confirm the details", text: "Correct anything that's off. Better inputs, better numbers." },
  { title: "Get your ROI report", text: "Pick an ADU type and size. Your report updates live, and you can download it as a PDF." },
];

const METRICS = [
  { title: "All-in build cost", text: "Construction, architectural plans, city permits, school fees, and utility connections." },
  { title: "Rent from real comps", text: "Long-term rent from nearby rental comps for an ADU of your size." },
  { title: "Short-term vs. long-term", text: "Nightly rate, occupancy, and costs compared with a 12-month lease." },
  { title: "Cash flow & payback", text: "Year-one net income, cash-on-cash return, and a 15-year cumulative cash-flow curve." },
  { title: "Added home value", text: "What the new square footage and its income may add to your home's value." },
  { title: "A link and a PDF", text: "A private link to your report and a PDF to share with your lender or partner." },
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
      <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr]">
        <h2 id="how-heading" className="font-serif text-5xl leading-[1.02] tracking-tight sm:text-6xl">
          Three steps. <em className="italic text-ink-soft">Two minutes.</em>
        </h2>
        <ol className="grid gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-3">
          {STEPS.map((step, index) => (
            <li key={step.title} className="bg-paper p-6">
              <span className="font-serif text-4xl text-ink-soft">0{index + 1}</span>
              <h3 className="mt-8 text-lg font-semibold tracking-tight">{step.title}</h3>
              <p className="mt-2 text-sm leading-6 text-ink-soft">{step.text}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

export function ReportContents() {
  return (
    <section id="report" className="scroll-mt-20 bg-ink text-white" aria-labelledby="report-heading">
      <div className="mx-auto max-w-[1400px] px-4 py-20 sm:px-6 md:py-28">
        <p className="text-xs font-medium uppercase tracking-[0.2em] text-[#9fe0d8]">What&apos;s in your report</p>
        <h2 id="report-heading" className="mt-4 max-w-3xl font-serif text-5xl leading-[1.02] tracking-tight sm:text-6xl">
          Every number you need before you call a builder.
        </h2>
        <ul className="mt-14 grid gap-px overflow-hidden rounded-2xl border border-white/10 bg-white/10 sm:grid-cols-2 lg:grid-cols-3">
          {METRICS.map((metric) => (
            <li key={metric.title} className="bg-ink p-6 sm:p-8">
              <h3 className="text-lg font-semibold tracking-tight">{metric.title}</h3>
              <p className="mt-2 text-sm leading-6 text-white/60">{metric.text}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

export function Faq() {
  return (
    <section id="faq" className="mx-auto max-w-[1400px] scroll-mt-20 px-4 py-20 sm:px-6 md:py-28" aria-labelledby="faq-heading">
      <div className="grid gap-10 lg:grid-cols-[0.8fr_1.2fr]">
        <h2 id="faq-heading" className="font-serif text-5xl leading-[1.02] tracking-tight sm:text-6xl">
          Questions
        </h2>
        <div className="divide-y divide-line border-y border-line">
          {FAQ.map((item) => (
            <details key={item.q} className="group py-5">
              <summary className="flex cursor-pointer list-none items-center justify-between gap-6 text-lg font-medium tracking-tight">
                {item.q}
                <span className="text-2xl font-light text-ink-soft transition group-open:rotate-45" aria-hidden="true">
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
      <div className="mx-auto max-w-[1400px] rounded-[28px] bg-pine px-6 py-16 text-center text-white sm:py-24">
        <h2 id="cta-heading" className="mx-auto max-w-3xl font-serif text-5xl leading-[1.02] tracking-tight sm:text-6xl">
          Know your ADU&apos;s return <em className="italic text-[#9fe0d8]">before</em> you build.
        </h2>
        <a
          href="#start"
          className="mt-10 inline-flex min-h-14 items-center rounded-full bg-white px-8 text-base font-semibold text-ink hover:bg-paper"
        >
          Get my free ROI report
        </a>
      </div>
    </section>
  );
}
