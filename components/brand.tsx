import { BRAND } from "@/lib/brand";

/** House outline whose roofline continues into a rising arrow: a home that returns. */
export function Mark({ className = "h-8 w-8" }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className} aria-hidden="true">
      <rect width="32" height="32" rx="9" fill="#0c0d0c" />
      <path d="M8 24.5v-8.2l7-5.8 4.2 3.5" fill="none" stroke="#f6f5f1" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M8 24.5h13.5" fill="none" stroke="#f6f5f1" strokeWidth="2" strokeLinecap="round" />
      <path d="M17.5 17.5 24.5 10.5M19.8 10.5h4.7v4.7" fill="none" stroke="#5fc2b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function Logo({ tone = "dark" }: { tone?: "dark" | "light" }) {
  return (
    <span className="flex items-center gap-2.5">
      <Mark />
      <span className={`text-[15px] font-semibold tracking-tight ${tone === "light" ? "text-white" : "text-ink"}`}>
        {BRAND.short}
        <span className={`font-normal ${tone === "light" ? "text-white/60" : "text-ink-soft"}`}> Calculator</span>
      </span>
    </span>
  );
}
