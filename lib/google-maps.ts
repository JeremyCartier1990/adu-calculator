"use client";

// Loads the Google Maps JavaScript API once, with just the types this app uses.

export type GLatLng = { lat(): number; lng(): number };
export type GListener = { remove(): void };
export type GPath = { getArray(): GLatLng[]; addListener(event: string, handler: () => void): GListener };
export type GMap = {
  getCenter(): GLatLng | undefined;
  setOptions(options: Record<string, unknown>): void;
  fitBounds(bounds: unknown, padding?: number): void;
  addListener(event: string, handler: (event: { latLng?: GLatLng }) => void): GListener;
};
export type GShape = {
  getPath(): GPath;
  setPath(path: Array<{ lat: number; lng: number }>): void;
  setOptions(options: Record<string, unknown>): void;
  setMap(map: GMap | null): void;
  addListener(event: string, handler: () => void): GListener;
};
export type GMaps = {
  Map: new (element: HTMLElement, options: Record<string, unknown>) => GMap;
  Polygon: new (options: Record<string, unknown>) => GShape;
  Polyline: new (options: Record<string, unknown>) => GShape;
  LatLngBounds: new () => { extend(point: { lat: number; lng: number }): void };
};

type MapsWindow = Window & {
  google?: { maps?: GMaps };
  __aduMapsReady?: () => void;
  gm_authFailure?: () => void;
};

let loading: Promise<GMaps> | null = null;
let keyPromise: Promise<string | null> | null = null;
const authFailures = new Set<() => void>();

function mapsKey(): Promise<string | null> {
  keyPromise ??= fetch("/api/maps/config")
    .then((response) => response.json() as Promise<{ key: string | null }>)
    .then((data) => data.key)
    .catch(() => null);
  return keyPromise;
}

/** Called when Google rejects the key (API not enabled, or this site isn't an allowed referrer). */
export function onMapsAuthFailure(handler: () => void): () => void {
  authFailures.add(handler);
  return () => authFailures.delete(handler);
}

export function loadGoogleMaps(): Promise<GMaps> {
  const w = window as MapsWindow;
  if (w.google?.maps?.Map) return Promise.resolve(w.google.maps);
  loading ??= mapsKey().then(
    (key) =>
      new Promise<GMaps>((resolve, reject) => {
        if (!key) {
          reject(new Error("no_key"));
          return;
        }
        w.gm_authFailure = () => authFailures.forEach((handler) => handler());
        w.__aduMapsReady = () => (w.google?.maps ? resolve(w.google.maps) : reject(new Error("no_maps")));
        const script = document.createElement("script");
        script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&v=weekly&loading=async&callback=__aduMapsReady`;
        script.async = true;
        script.onerror = () => reject(new Error("script"));
        document.head.appendChild(script);
      }),
  );
  return loading;
}
