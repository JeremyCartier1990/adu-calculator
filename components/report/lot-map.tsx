"use client";

import { useEffect, useRef, useState } from "react";
import { ASSUMPTIONS } from "@/lib/assumptions";
import { areaSqft, centroid, footprintSqft, rectangleFootprint, rotateFootprint, sideLengthsFt, type LatLng } from "@/lib/footprint";
import { loadGoogleMaps, onMapsAuthFailure, type GListener, type GMap, type GMaps, type GShape } from "@/lib/google-maps";

const TEAL = "#5fc2b8";
const shapeStyle = { strokeColor: TEAL, strokeOpacity: 1, strokeWeight: 3, fillColor: TEAL, fillOpacity: 0.28 };

type Status = "loading" | "ready" | "unavailable";

/**
 * Satellite view of the lot. With `onFootprint`, the homeowner places or draws the
 * ADU on it (tap the corners, drag them, turn the shape) and sees its square footage.
 * Touch-first: big buttons under the map, one-finger dragging while a shape is on it.
 */
export function LotMap({
  address,
  latitude,
  longitude,
  footprint,
  onFootprint,
  targetSqft,
  onUseSqft,
  canPlace = true,
  fill = false,
  drawOnReady = false,
}: {
  address: string;
  latitude: number | null;
  longitude: number | null;
  footprint: LatLng[] | null;
  /** Omit for a read-only map. */
  onFootprint?: (points: LatLng[] | null) => void;
  targetSqft: number;
  onUseSqft?: (sqft: number) => void;
  /** False for garage conversions, which reuse the existing garage. */
  canPlace?: boolean;
  /** Fill the parent's height, as in the full-screen map. */
  fill?: boolean;
  /** Start drawing corners as soon as the map is up. */
  drawOnReady?: boolean;
}) {
  const editable = Boolean(onFootprint) && canPlace;
  const element = useRef<HTMLDivElement>(null);
  const maps = useRef<GMaps | null>(null);
  const map = useRef<GMap | null>(null);
  const polygon = useRef<GShape | null>(null);
  const line = useRef<GShape | null>(null);
  const polygonListeners = useRef<GListener[]>([]);
  const lastEmitted = useRef<string | null>(null);
  const emit = useRef(onFootprint);
  const [status, setStatus] = useState<Status>(latitude == null || longitude == null ? "unavailable" : "loading");
  const [drawing, setDrawing] = useState<LatLng[] | null>(null);
  const hasLocation = latitude != null && longitude != null;

  useEffect(() => {
    emit.current = onFootprint;
  }, [onFootprint]);

  // Create the map once we know where the property is.
  useEffect(() => {
    if (!hasLocation || !element.current) return;
    let cancelled = false;
    const stopAuth = onMapsAuthFailure(() => setStatus("unavailable"));
    loadGoogleMaps()
      .then((google) => {
        if (cancelled || !element.current) return;
        maps.current = google;
        const start = footprint?.length ? centroid(footprint) : { lat: latitude, lng: longitude };
        map.current = new google.Map(element.current, {
          center: start,
          zoom: 20,
          mapTypeId: "satellite",
          tilt: 0,
          heading: 0,
          disableDefaultUI: true,
          zoomControl: true,
          fullscreenControl: !fill,
          clickableIcons: false,
          keyboardShortcuts: false,
          gestureHandling: "cooperative",
        });
        // A pin on the address, so it's clear which building on the block is the property.
        new google.Marker({ position: { lat: latitude, lng: longitude }, map: map.current, title: address, clickable: false, zIndex: 1 });
        setStatus("ready");
      })
      .catch(() => !cancelled && setStatus("unavailable"));
    return () => {
      cancelled = true;
      stopAuth();
    };
    // The map is created once per location; later footprint changes are drawn by the effect below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasLocation, latitude, longitude]);

  // Keep the shape on the map in sync with the saved footprint.
  useEffect(() => {
    const google = maps.current;
    if (status !== "ready" || !google || !map.current) return;
    const json = JSON.stringify(footprint ?? null);
    if (!footprint || drawing) {
      polygon.current?.setMap(null);
      polygon.current = null;
      lastEmitted.current = json;
      return;
    }
    if (polygon.current && json === lastEmitted.current) return;
    polygonListeners.current.forEach((listener) => listener.remove());
    polygon.current?.setMap(null);
    const shape = new google.Polygon({ ...shapeStyle, paths: footprint, editable, draggable: editable, map: map.current, zIndex: 2 });
    polygon.current = shape;
    lastEmitted.current = json;
    if (editable) {
      const report = () => {
        const points = shape
          .getPath()
          .getArray()
          .map((point) => ({ lat: point.lat(), lng: point.lng() }));
        lastEmitted.current = JSON.stringify(points);
        emit.current?.(points);
      };
      const path = shape.getPath();
      polygonListeners.current = [
        path.addListener("set_at", report),
        path.addListener("insert_at", report),
        path.addListener("remove_at", report),
        shape.addListener("dragend", report),
      ];
    }
  }, [footprint, status, editable, drawing]);

  // Drawing mode: each tap adds a corner.
  useEffect(() => {
    const google = maps.current;
    if (status !== "ready" || !google || !map.current || drawing == null) return;
    line.current ??= new google.Polyline({ ...shapeStyle, map: map.current, clickable: false, zIndex: 3 });
    line.current.setPath(drawing);
    const listener = map.current.addListener("click", (event) => {
      if (!event.latLng) return;
      const point = { lat: event.latLng.lat(), lng: event.latLng.lng() };
      setDrawing((current) => (current ? [...current, point] : current));
    });
    return () => listener.remove();
  }, [drawing, status]);

  useEffect(() => {
    if (drawing == null) {
      line.current?.setMap(null);
      line.current = null;
    }
  }, [drawing]);

  const drewOnReady = useRef(false);
  useEffect(() => {
    if (!drawOnReady || !editable || status !== "ready" || drewOnReady.current) return;
    drewOnReady.current = true;
    // Same as tapping "Draw corners" once the map has loaded.
    setDrawing([]);
  }, [drawOnReady, editable, status]);

  // One-finger dragging while there's a shape to move; otherwise the page scrolls as usual.
  useEffect(() => {
    map.current?.setOptions({ gestureHandling: editable && (drawing != null || footprint) ? "greedy" : "cooperative" });
  }, [editable, drawing, footprint, status]);

  const shape = drawing ?? footprint;
  const area = shape && shape.length >= 3 ? areaSqft(shape) : 0;
  const sides = shape && shape.length >= 3 ? sideLengthsFt(shape) : [];
  const sizeNote =
    area > 0 && (area < ASSUMPTIONS.size.min || area > ASSUMPTIONS.size.max)
      ? `ADU estimates cover ${ASSUMPTIONS.size.min.toLocaleString("en-US")}–${ASSUMPTIONS.size.max.toLocaleString("en-US")} sqft.`
      : null;
  const usable = shape && shape.length >= 3 ? footprintSqft(shape) : ASSUMPTIONS.size.min;

  function place() {
    const center = map.current?.getCenter();
    const at = center ? { lat: center.lat(), lng: center.lng() } : { lat: latitude!, lng: longitude! };
    setDrawing(null);
    onFootprint?.(rectangleFootprint(at, targetSqft));
  }

  const button =
    "inline-flex min-h-12 items-center justify-center rounded-lg border px-3 text-sm font-semibold transition disabled:opacity-40";
  const quiet = `${button} border-line bg-white text-ink hover:border-ink`;
  const strong = `${button} border-ink bg-ink text-white hover:bg-ink/85`;

  return (
    <div
      id={editable ? "lot-map" : undefined}
      className={fill ? "flex h-full min-h-0 flex-col bg-paper" : "scroll-mt-4 overflow-hidden rounded-xl border border-line bg-paper"}
    >
      <div
        className={`relative w-full ${
          fill ? "min-h-0 flex-1" : status === "unavailable" ? "h-40" : "h-[58svh] max-h-[620px] min-h-[320px] lg:h-[520px]"
        }`}
      >
        {/* Hidden, not removed, when unavailable: Google draws its own error box in it. */}
        <div ref={element} className={`absolute inset-0 ${status === "unavailable" ? "hidden" : ""}`} role="region" aria-label={`Satellite view of ${address}`} />
        {status === "loading" ? (
          <p className="absolute inset-0 grid place-items-center bg-paper-deep text-sm text-ink-soft">Loading satellite view…</p>
        ) : null}
        {status === "unavailable" ? (
          <p className="absolute inset-0 grid place-items-center px-6 text-center text-sm text-ink-soft">
            {hasLocation ? "The satellite view isn't available right now." : "We don't have map coordinates for this address yet."}
          </p>
        ) : null}
        {status === "ready" && drawing ? (
          <p className="pointer-events-none absolute inset-x-3 top-3 rounded-lg bg-ink/85 px-3 py-2 text-center text-sm font-medium text-white">
            {drawing.length < 3 ? `Tap each corner of the ADU (${drawing.length} placed)` : `${drawing.length} corners · ${area.toLocaleString("en-US")} sqft · tap Finish`}
          </p>
        ) : null}
        {status === "ready" && !drawing && area > 0 ? (
          <p className="pointer-events-none absolute left-3 top-3 rounded-lg bg-ink/85 px-3 py-1.5 text-sm font-semibold tabular-nums text-white">
            {area.toLocaleString("en-US")} sqft
          </p>
        ) : null}
      </div>

      {status === "ready" && editable ? (
        <div className={`space-y-3 p-3 sm:p-4 ${fill ? "shrink-0 border-t border-line pb-[max(0.75rem,env(safe-area-inset-bottom))]" : ""}`}>
          {area > 0 && !drawing ? (
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-sm text-ink">
                <span className="font-semibold tabular-nums">{area.toLocaleString("en-US")} sqft</span>
                {sides.length ? <span className="text-ink-soft"> · sides {sides.map((side) => `${side} ft`).join(" × ")}</span> : null}
                {sizeNote ? <span className="block text-xs text-clay">{sizeNote}</span> : null}
              </p>
              {onUseSqft && usable !== targetSqft ? (
                <button type="button" onClick={() => onUseSqft(usable)} className={`${quiet} min-h-10 px-3 text-pine`}>
                  Use {usable.toLocaleString("en-US")} sqft as the ADU size
                </button>
              ) : null}
            </div>
          ) : null}

          {drawing ? (
            <div className="grid grid-cols-3 gap-2">
              <button type="button" className={quiet} disabled={drawing.length === 0} onClick={() => setDrawing(drawing.slice(0, -1))}>
                Undo
              </button>
              <button type="button" className={quiet} onClick={() => setDrawing(null)}>
                Cancel
              </button>
              <button
                type="button"
                className={strong}
                disabled={drawing.length < 3}
                onClick={() => {
                  onFootprint?.(drawing);
                  setDrawing(null);
                }}
              >
                Finish
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
              <button type="button" className={strong} onClick={place}>
                {footprint ? "Reset" : "Place"} {targetSqft.toLocaleString("en-US")} sqft
              </button>
              <button type="button" className={quiet} onClick={() => setDrawing([])}>
                Draw corners
              </button>
              {footprint ? (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    <button type="button" className={quiet} aria-label="Turn left" onClick={() => onFootprint?.(rotateFootprint(footprint, -15))}>
                      ↺
                    </button>
                    <button type="button" className={quiet} aria-label="Turn right" onClick={() => onFootprint?.(rotateFootprint(footprint, 15))}>
                      ↻
                    </button>
                  </div>
                  <button type="button" className={quiet} onClick={() => onFootprint?.(null)}>
                    Clear
                  </button>
                </>
              ) : null}
            </div>
          )}
          <p className="text-xs leading-5 text-ink-soft">
            {drawing
              ? "Tap the map at each corner, in order around the building."
              : footprint
                ? "Drag the shape to move it. Drag a corner to reshape it; drag a midpoint to add a corner."
                : "Place a footprint at the size you picked, or draw your own corners."}
          </p>
        </div>
      ) : null}
      {status === "ready" && Boolean(onFootprint) && !canPlace ? (
        <p className="p-3 text-xs leading-5 text-ink-soft sm:p-4">A garage conversion uses the existing garage, so there&apos;s nothing to place.</p>
      ) : null}
    </div>
  );
}
