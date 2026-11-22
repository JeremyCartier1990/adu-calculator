"use client";

import { useEffect, useId, useRef, useState } from "react";

type Suggestion = { id: string; text: string };

/**
 * Address field with Google Places suggestions through /api/places. When the
 * server has no Places key it behaves as a plain text input.
 */
export function AddressInput({
  value,
  onChange,
  onPick,
  invalid,
  inputRef,
  tone = "dark",
}: {
  value: string;
  onChange: (value: string) => void;
  /** A suggestion was chosen; the caller usually submits right away. */
  onPick: (value: string) => void;
  invalid?: boolean;
  inputRef?: React.Ref<HTMLInputElement>;
  tone?: "dark" | "light";
}) {
  const listId = useId();
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const [enabled, setEnabled] = useState(true);
  const session = useRef<string>("");
  const lastPicked = useRef<string | null>(null);

  useEffect(() => {
    const input = value.trim();
    if (!enabled || input.length < 3 || input === lastPicked.current) return;
    session.current ||= crypto.randomUUID();
    const controller = new AbortController();
    const timer = setTimeout(() => {
      fetch("/api/places", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input, sessionToken: session.current }),
        signal: controller.signal,
      })
        .then((response) => response.json() as Promise<{ ok: boolean; code?: string; suggestions: Suggestion[] }>)
        .then((data) => {
          if (data.code === "not_configured") setEnabled(false);
          setSuggestions(data.suggestions ?? []);
          setOpen((data.suggestions ?? []).length > 0);
          setActive(-1);
        })
        .catch(() => {});
    }, 220);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [enabled, value]);

  function pick(suggestion: Suggestion) {
    lastPicked.current = suggestion.text;
    session.current = "";
    setOpen(false);
    setSuggestions([]);
    onChange(suggestion.text);
    onPick(suggestion.text);
  }

  const light = tone === "light";
  const expanded = open && suggestions.length > 0;

  return (
    <div className="relative w-full">
      {light ? (
        <svg viewBox="0 0 20 20" className="pointer-events-none absolute left-3.5 top-1/2 h-5 w-5 -translate-y-1/2 text-pine" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
          <path d="M10 18s-5.5-5.2-5.5-9.5a5.5 5.5 0 0111 0C15.5 12.8 10 18 10 18z" strokeLinejoin="round" />
          <circle cx="10" cy="8.5" r="2" />
        </svg>
      ) : null}
      <input
        ref={inputRef}
        id="property-address"
        name="address"
        type="text"
        role="combobox"
        aria-label="Property address"
        aria-expanded={expanded}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
        aria-invalid={invalid || undefined}
        autoComplete="street-address"
        placeholder="Enter your property address"
        value={value}
        onChange={(event) => {
          lastPicked.current = null;
          onChange(event.target.value);
        }}
        onFocus={() => setOpen(suggestions.length > 0)}
        onBlur={() => setTimeout(() => setOpen(false), 120)}
        onKeyDown={(event) => {
          if (!expanded) return;
          if (event.key === "ArrowDown") {
            event.preventDefault();
            setActive((index) => (index + 1) % suggestions.length);
          } else if (event.key === "ArrowUp") {
            event.preventDefault();
            setActive((index) => (index <= 0 ? suggestions.length - 1 : index - 1));
          } else if (event.key === "Enter" && active >= 0) {
            event.preventDefault();
            pick(suggestions[active]);
          } else if (event.key === "Escape") {
            setOpen(false);
          }
        }}
        className={`w-full border px-5 text-base outline-none transition ${
          light
            ? "min-h-14 rounded-lg border-transparent bg-transparent pl-11 text-ink placeholder:text-ink-soft focus:bg-paper"
            : "min-h-14 rounded-full border-line bg-white text-ink placeholder:text-ink-soft focus:border-ink focus:ring-4 focus:ring-ink/10"
        } ${invalid ? "border-clay" : ""}`}
      />
      {expanded ? (
        <ul
          id={listId}
          role="listbox"
          className="absolute inset-x-0 top-full z-30 mt-2 overflow-hidden rounded-2xl border border-line bg-white py-1 text-left text-ink shadow-[0_20px_50px_rgba(12,13,12,0.18)]"
        >
          {suggestions.map((suggestion, index) => (
            <li
              key={suggestion.id}
              id={`${listId}-${index}`}
              role="option"
              aria-selected={index === active}
              onMouseDown={(event) => {
                event.preventDefault();
                pick(suggestion);
              }}
              onMouseEnter={() => setActive(index)}
              className={`cursor-pointer px-5 py-3 text-sm ${index === active ? "bg-paper" : ""}`}
            >
              {suggestion.text}
            </li>
          ))}
          <li role="presentation" className="px-5 pb-1 pt-2 text-right text-[11px] text-ink-soft">
            Powered by Google
          </li>
        </ul>
      ) : null}
    </div>
  );
}
