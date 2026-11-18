import { Mark } from "@/components/site-header";

export function SiteFooter() {
  return (
    <footer className="border-t border-line">
      <div className="mx-auto max-w-6xl px-4 py-10">
        <div className="flex items-center gap-2.5">
          <Mark className="h-8 w-8" />
          <p className="font-serif text-lg">Home First Remodel</p>
        </div>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-ink-soft">
          Garage conversions and ADUs for Los Angeles homeowners, from the Westside to the rest of the city.
          Every cost, rent, and value figure on this page is an estimate, not a quote. Confirm it with a licensed
          contractor, a designer, and a tax advisor before you spend money.
        </p>
        <p className="mt-4 text-xs leading-5 text-ink-soft">
          Planning rates live in <span className="font-medium">lib/assumptions.ts</span>. Property and rent data,
          when a lookup succeeds, comes from RentCast and is cached for 24 hours.
        </p>
      </div>
    </footer>
  );
}
