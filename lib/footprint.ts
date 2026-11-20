// ADU footprint geometry on a lot. At lot scale (tens of meters) the earth is
// flat enough to measure in local meters around the shape's first point.

export type LatLng = { lat: number; lng: number };

const METERS_PER_DEGREE = 111_320;
const SQFT_PER_SQM = 10.7639;
const FEET_PER_METER = 3.28084;

type Point = { x: number; y: number };

function scale(origin: LatLng) {
  return { x: METERS_PER_DEGREE * Math.cos((origin.lat * Math.PI) / 180), y: METERS_PER_DEGREE };
}

function toLocal(points: LatLng[], origin: LatLng): Point[] {
  const s = scale(origin);
  return points.map((p) => ({ x: (p.lng - origin.lng) * s.x, y: (p.lat - origin.lat) * s.y }));
}

function toLatLng(points: Point[], origin: LatLng): LatLng[] {
  const s = scale(origin);
  return points.map((p) => ({ lat: origin.lat + p.y / s.y, lng: origin.lng + p.x / s.x }));
}

/** Area of a drawn shape in square feet (shoelace formula). */
export function areaSqft(points: LatLng[]): number {
  if (points.length < 3) return 0;
  const local = toLocal(points, points[0]);
  let twice = 0;
  for (let i = 0; i < local.length; i++) {
    const a = local[i];
    const b = local[(i + 1) % local.length];
    twice += a.x * b.y - b.x * a.y;
  }
  return Math.round((Math.abs(twice) / 2) * SQFT_PER_SQM);
}

/** Length of each side in feet, in drawing order. */
export function sideLengthsFt(points: LatLng[]): number[] {
  if (points.length < 2) return [];
  const local = toLocal(points, points[0]);
  return local.map((a, i) => {
    const b = local[(i + 1) % local.length];
    return Math.round(Math.hypot(b.x - a.x, b.y - a.y) * FEET_PER_METER);
  });
}

export function centroid(points: LatLng[]): LatLng {
  const lat = points.reduce((sum, p) => sum + p.lat, 0) / points.length;
  const lng = points.reduce((sum, p) => sum + p.lng, 0) / points.length;
  return { lat, lng };
}

/** A rectangle of `sqft` centered on `center`, 4:5 proportions, turned `degrees` clockwise. */
export function rectangleFootprint(center: LatLng, sqft: number, degrees = 0): LatLng[] {
  const areaSqm = sqft / SQFT_PER_SQM;
  const width = Math.sqrt(areaSqm * 0.8);
  const depth = areaSqm / width;
  const corners: Point[] = [
    { x: -width / 2, y: depth / 2 },
    { x: width / 2, y: depth / 2 },
    { x: width / 2, y: -depth / 2 },
    { x: -width / 2, y: -depth / 2 },
  ];
  return toLatLng(rotateLocal(corners, degrees), center);
}

function rotateLocal(points: Point[], degrees: number): Point[] {
  const r = (-degrees * Math.PI) / 180;
  const cos = Math.cos(r);
  const sin = Math.sin(r);
  return points.map((p) => ({ x: p.x * cos - p.y * sin, y: p.x * sin + p.y * cos }));
}

/** Turn a shape around its center, clockwise for positive degrees. */
export function rotateFootprint(points: LatLng[], degrees: number): LatLng[] {
  const center = centroid(points);
  return toLatLng(rotateLocal(toLocal(points, center), degrees), center);
}

/** A saved footprint, or null when the value isn't 3-24 sensible points. */
export function parseFootprint(value: unknown): LatLng[] | null {
  if (!Array.isArray(value) || value.length < 3 || value.length > 24) return null;
  const points: LatLng[] = [];
  for (const item of value) {
    const lat = (item as { lat?: unknown })?.lat;
    const lng = (item as { lng?: unknown })?.lng;
    if (typeof lat !== "number" || typeof lng !== "number" || Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
    points.push({ lat: Math.round(lat * 1e7) / 1e7, lng: Math.round(lng * 1e7) / 1e7 });
  }
  return points;
}
