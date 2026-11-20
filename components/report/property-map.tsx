"use client";

import { useState } from "react";

/** Satellite view of the lot. Hides itself when there's no location or the map service is off. */
export function PropertyMap({
  address,
  latitude,
  longitude,
  className = "",
}: {
  address: string;
  latitude: number | null;
  longitude: number | null;
  className?: string;
}) {
  const [failed, setFailed] = useState(false);
  if (failed) return null;
  const query =
    latitude != null && longitude != null
      ? new URLSearchParams({ lat: String(latitude), lng: String(longitude) })
      : new URLSearchParams({ address });

  return (
    <figure className={`relative overflow-hidden rounded-xl border border-line bg-paper-deep ${className}`}>
      {/* eslint-disable-next-line @next/next/no-img-element -- proxied Google image, not a static asset */}
      <img
        src={`/api/map?${query}`}
        alt={`Satellite view of ${address}`}
        className="h-full w-full object-cover"
        onError={() => setFailed(true)}
        // A server-rendered image can fail before hydration, when onError isn't attached yet.
        ref={(img) => {
          if (img?.complete && img.naturalWidth === 0) setFailed(true);
        }}
      />
      <span className="pointer-events-none absolute left-1/2 top-1/2 h-24 w-32 -translate-x-1/2 -translate-y-1/2 rounded-sm border-2 border-dashed border-[#5fc2b8] shadow-[0_0_0_9999px_rgba(15,14,12,0.12)]" aria-hidden="true" />
      <figcaption className="absolute bottom-3 left-3 rounded-md bg-ink/80 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.12em] text-white">
        Your lot · satellite
      </figcaption>
    </figure>
  );
}
