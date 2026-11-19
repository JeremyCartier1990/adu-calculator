import { Logo } from "@/components/brand";
import { BRAND } from "@/lib/brand";

export function SiteFooter() {
  return (
    <footer className="mx-auto max-w-[1400px] px-4 py-12 sm:px-6">
      <div className="flex flex-col gap-6 border-t border-line pt-10 md:flex-row md:items-start md:justify-between">
        <Logo />
        <p className="max-w-xl text-sm leading-6 text-ink-soft">
          {BRAND.name} is built with {BRAND.builder}, a Los Angeles ADU and garage-conversion builder. Every cost, rent, and value
          figure is an estimate, not a quote; confirm it with a licensed contractor, a designer, and a tax advisor before you spend
          money. Property and rent data from RentCast; short-term market data from AirROI.
        </p>
      </div>
      <p className="mt-8 text-xs text-ink-soft">
        © {BRAND.name} · {BRAND.domain}
      </p>
    </footer>
  );
}
