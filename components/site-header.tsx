import { Logo } from "@/components/brand";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-20 bg-paper/85 backdrop-blur">
      <a className="skip-link" href="#start">
        Skip to the address form
      </a>
      <div className="mx-auto flex h-16 max-w-[1400px] items-center justify-between gap-3 px-4 sm:px-6">
        <a href="#top" aria-label="ADU ROI Calculator, top of page">
          <Logo />
        </a>
        <nav aria-label="Page" className="flex items-center gap-6">
          <a href="#how" className="hidden text-sm text-ink-soft hover:text-ink md:inline">
            How it works
          </a>
          <a href="#report" className="hidden text-sm text-ink-soft hover:text-ink md:inline">
            The report
          </a>
          <a href="#faq" className="hidden text-sm text-ink-soft hover:text-ink md:inline">
            FAQ
          </a>
          <a href="#start" className="inline-flex min-h-10 items-center rounded-full bg-ink px-4 text-sm font-semibold text-white hover:bg-ink/85">
            Get my report
          </a>
        </nav>
      </div>
    </header>
  );
}
