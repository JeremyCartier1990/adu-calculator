"use client";

import { useEffect, useRef } from "react";
import { LotMap } from "@/components/report/lot-map";
import type { LatLng } from "@/lib/footprint";

/** The lot map in a full-screen popup, so there's room to see the lot and place the ADU. */
export function LotMapDialog({
  mode,
  onClose,
  ...map
}: {
  /** "draw" starts tapping corners as soon as the map loads. */
  mode: "open" | "draw" | null;
  onClose: () => void;
  address: string;
  latitude: number | null;
  longitude: number | null;
  footprint: LatLng[] | null;
  onFootprint: (points: LatLng[] | null) => void;
  targetSqft: number;
  onUseSqft: (sqft: number) => void;
  canPlace: boolean;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (mode && !dialog.open) dialog.showModal();
    if (!mode && dialog.open) dialog.close();
  }, [mode]);

  return (
    <dialog
      ref={ref}
      aria-label="Place the ADU on your lot"
      onCancel={(event) => {
        event.preventDefault();
        onClose();
      }}
      className="m-0 h-[100dvh] max-h-none w-screen max-w-none bg-paper p-0 text-ink backdrop:bg-ink/60"
    >
      {mode ? (
        <div className="flex h-full flex-col">
          <div className="flex shrink-0 items-center justify-between gap-3 border-b border-line px-4 py-3 pt-[max(0.75rem,env(safe-area-inset-top))] sm:px-6">
            <div className="min-w-0">
              <h2 className="font-display text-xl leading-tight text-ink sm:text-2xl">Place the ADU on your lot</h2>
              <p className="truncate text-sm text-ink-soft">{map.address} · sizes are approximate</p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex min-h-11 shrink-0 items-center rounded-lg bg-ink px-4 text-sm font-semibold text-white hover:bg-ink/85"
            >
              Done
            </button>
          </div>
          <div className="min-h-0 flex-1">
            <LotMap {...map} fill drawOnReady={mode === "draw"} />
          </div>
        </div>
      ) : null}
    </dialog>
  );
}
