/**
 * Ort / Platzname + Adresse für Anzeige und ICS.
 */

export function formatFullLocation(
  place: string | null | undefined,
  address: string | null | undefined,
): string {
  const p = (place ?? '').trim();
  const a = (address ?? '').trim();
  if (p && a && p.toLowerCase() === a.toLowerCase()) return p;
  if (p && a) return `${p}, ${a}`;
  return p || a || '';
}

/** Zwei Zeilen für UI (Platzname, Adresse) */
export function formatLocationTwoLines(
  place: string | null | undefined,
  address: string | null | undefined,
): { line1: string | null; line2: string | null } {
  const p = (place ?? '').trim();
  const a = (address ?? '').trim();
  return {
    line1: p || null,
    line2: a || null,
  };
}

/** Speichert Platzname + Adresse in einem Feld (kompatibel ohne DB-Schema-Änderung). */
export function combineLocationParts(
  place: string | null | undefined,
  address: string | null | undefined,
): string | null {
  const p = (place ?? '').trim();
  const a = (address ?? '').trim();
  if (!p && !a) return null;
  if (p && a) return `${p}\n${a}`;
  return p || a;
}

/** Kurzer Platzname für Feed (ohne Straße/Adresse/PLZ). */
function feedVenueLooksLikeAddress(segment: string): boolean {
  const t = segment.trim();
  if (!t) return false;
  if (/^\d{4,5}(\s|$)/.test(t)) return true;
  if (/\b(straße|str\.|gasse|weg|allee|ring|bundesstraße|bahnstraße)\b/i.test(t) && /\d/.test(t)) return true;
  if (/^\d+[a-z]?\s+\S/i.test(t)) return true;
  return false;
}

function stripPostalCityTail(s: string): string {
  return s.replace(/,\s*\d{4,5}\s+[\wÄÖÜäöüß.\- ]+$/i, '').trim();
}

export function formatFeedVenueShort(location: string | null | undefined): string | null {
  const parsed = splitCombinedLocation(location);
  let place = (parsed.place ?? '').trim();
  if (place) {
    const commaParts = place.split(',').map((p) => p.trim()).filter(Boolean);
    if (commaParts.length > 1 && commaParts.slice(1).some(feedVenueLooksLikeAddress)) {
      place = commaParts[0];
    }
    place = stripPostalCityTail(place);
    if (place && !feedVenueLooksLikeAddress(place)) return place;
  }
  const raw = (location ?? '').trim();
  if (!raw) return null;
  const commaIdx = raw.indexOf(',');
  if (commaIdx > 0) {
    const first = raw.slice(0, commaIdx).trim();
    const rest = raw.slice(commaIdx + 1).trim();
    if (rest && (/\d/.test(rest) || feedVenueLooksLikeAddress(rest))) {
      const cleaned = stripPostalCityTail(first);
      if (cleaned && !feedVenueLooksLikeAddress(cleaned)) return cleaned;
    }
  }
  const cleaned = stripPostalCityTail(raw);
  if (cleaned && !feedVenueLooksLikeAddress(cleaned)) return cleaned;
  return null;
}

/** Liest Platzname + Adresse aus einem gespeicherten location-Wert. */
export function splitCombinedLocation(value: string | null | undefined): { place: string; address: string } {
  const s = (value ?? '').trim();
  if (!s) return { place: '', address: '' };
  const lines = s.split('\n').map((v) => v.trim()).filter(Boolean);
  if (lines.length >= 2) {
    return { place: lines[0], address: lines.slice(1).join(', ') };
  }
  return { place: s, address: '' };
}
