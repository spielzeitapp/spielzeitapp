import { formatFullLocation, splitCombinedLocation } from './eventLocation';

export type MapsCoords = { lat: number; lng: number };

/** Koordinaten aus location/notes (z. B. „48.12,16.25“ oder „geo:48.12,16.25“). */
export function parseCoordsFromText(value: string | null | undefined): MapsCoords | null {
  const s = (value ?? '').trim();
  if (!s) return null;

  const geo = s.match(/geo:\s*(-?\d{1,3}(?:\.\d+)?)\s*,\s*(-?\d{1,3}(?:\.\d+)?)/i);
  if (geo) {
    const lat = Number(geo[1]);
    const lng = Number(geo[2]);
    if (isValidCoord(lat, lng)) return { lat, lng };
  }

  const pair = s.match(/(-?\d{1,2}(?:\.\d{4,})?)\s*[,;]\s*(-?\d{1,3}(?:\.\d{4,})?)/);
  if (pair) {
    const lat = Number(pair[1]);
    const lng = Number(pair[2]);
    if (isValidCoord(lat, lng)) return { lat, lng };
  }

  return null;
}

function isValidCoord(lat: number, lng: number): boolean {
  return Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180;
}

export function buildMapsNavigationUrl(opts: {
  lat?: number | null;
  lng?: number | null;
  place?: string | null;
  address?: string | null;
  locationRaw?: string | null;
}): string | null {
  const lat = opts.lat ?? null;
  const lng = opts.lng ?? null;
  if (lat != null && lng != null && isValidCoord(lat, lng)) {
    const isApple =
      typeof navigator !== 'undefined' && /iPhone|iPad|iPod/i.test(navigator.userAgent);
    if (isApple) {
      return `https://maps.apple.com/?daddr=${lat},${lng}`;
    }
    return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}`;
  }

  const query =
    formatFullLocation(opts.place, opts.address) ||
    (opts.locationRaw ?? '').trim().replace(/\n/g, ', ');
  if (!query) return null;

  const encoded = encodeURIComponent(query);
  const isApple =
    typeof navigator !== 'undefined' && /iPhone|iPad|iPod/i.test(navigator.userAgent);
  if (isApple) {
    return `https://maps.apple.com/?daddr=${encoded}`;
  }
  return `https://www.google.com/maps/dir/?api=1&destination=${encoded}`;
}

export function openMapsNavigation(opts: Parameters<typeof buildMapsNavigationUrl>[0]): boolean {
  const url = buildMapsNavigationUrl(opts);
  if (!url) return false;
  window.open(url, '_blank', 'noopener,noreferrer');
  return true;
}

export function resolveEventMapsCoords(
  location: string | null | undefined,
  notes: string | null | undefined,
): MapsCoords | null {
  return parseCoordsFromText(location) ?? parseCoordsFromText(notes);
}

export function resolveEventMapsPlaceAddress(location: string | null | undefined): {
  place: string;
  address: string;
} {
  const parsed = splitCombinedLocation(location);
  return { place: parsed.place, address: parsed.address };
}
