import { Logo } from "@/components/brand";
import { ArrowBox } from "@/components/eyebrow";

/** Ad landing header: the brand and one way into the address form, nothing that leads away from it. */
export function SiteHeader() {
  return (
    <header className="sticky top-0 z-20 border-b border-line/70 bg-paper/90 backdrop-blur">
      <a className="skip-link" href="#start">
        Skip to the address form
      </a>
      <div className="mx-auto flex h-16 max-w-[1400px] items-center justify-between gap-3 px-4 sm:px-6">
        <Logo />
        <a href="#start" className="inline-flex min-h-10 items-center gap-2.5 rounded-lg bg-ink py-1 pl-1 pr-4 text-sm font-medium text-white hover:bg-ink/85">
          <ArrowBox />
          Free report
        </a>
      </div>
    </header>
  );
}
