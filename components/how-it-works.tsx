const STEPS = [
  {
    title: "Find the home",
    text: "Enter an address and we ask RentCast once for public-record facts and an estimated value. Nothing runs while you type. If there's no match, type the numbers yourself.",
  },
  {
    title: "Choose the project",
    text: "Garage conversion, attached ADU, or detached cottage. Set the size and a finish level. Bedroom count follows the size, and the cost updates as you move the slider.",
  },
  {
    title: "Read the estimate",
    text: "Construction, plans, and permits. Rent after vacancy, maintenance, insurance, and added tax. Then payback and the value the new space may add.",
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="mx-auto max-w-6xl px-4 py-4 md:py-8" aria-labelledby="how-heading">
      <div className="max-w-2xl">
        <h2 id="how-heading" className="font-serif text-3xl tracking-tight sm:text-4xl">
          How the estimate works
        </h2>
        <p className="mt-3 text-base leading-7 text-ink-soft">
          A planning tool for a conversation with a builder — not an appraisal, a loan approval, or a construction contract.
        </p>
      </div>
      <ol className="mt-8 grid gap-4 md:grid-cols-3">
        {STEPS.map((step, index) => (
          <li key={step.title} className="rounded-3xl border border-line bg-surface p-5">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-pine text-sm font-semibold text-white">
              {index + 1}
            </span>
            <h3 className="mt-4 font-serif text-2xl tracking-tight">{step.title}</h3>
            <p className="mt-2 text-sm leading-6 text-ink-soft">{step.text}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
