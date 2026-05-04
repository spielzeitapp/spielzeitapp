/**
 * Anzeige von Geburtsdatum/Alter (Spielerprofil, Datenschutz je Viewer-Rolle).
 * birthdate: YYYY-MM-DD (nur Datum, keine Zeit).
 */

function parseDateOnlyYmd(isoYmd: string): Date | null {
  const s = isoYmd.trim();
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]) - 1;
  const day = Number(m[3]);
  const d = new Date(y, mo, day);
  if (d.getFullYear() !== y || d.getMonth() !== mo || d.getDate() !== day) return null;
  return d;
}

/** DD.MM.YYYY */
export function formatDateFull(isoYmd: string): string | null {
  const d = parseDateOnlyYmd(isoYmd);
  if (!d) return null;
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${dd}.${mm}.${yyyy}`;
}

/** DD.MM. (ohne Jahr) */
export function formatBirthdayShort(isoYmd: string): string | null {
  const d = parseDateOnlyYmd(isoYmd);
  if (!d) return null;
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  return `${dd}.${mm}.`;
}

/** Vollendete Lebensjahre (Kalendertag, lokale Datumsgrenze). */
export function getAge(isoYmd: string): number | null {
  const birth = parseDateOnlyYmd(isoYmd);
  if (!birth) return null;
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const m = today.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) age -= 1;
  return age >= 0 ? age : null;
}

export type PlayerBirthPrivacyMode = 'trainer_view' | 'family_view' | 'fan_view';

/** effectiveRole aus Session (lowercase Keys wie in rbac). */
export function getPlayerBirthPrivacyMode(viewerEffectiveRole: string): PlayerBirthPrivacyMode {
  const r = (viewerEffectiveRole ?? '').trim().toLowerCase();
  if (r === 'trainer' || r === 'co_trainer' || r === 'head_coach') return 'trainer_view';
  if (r === 'parent' || r === 'player') return 'family_view';
  return 'fan_view';
}

export type PlayerBirthDisplayLines = { geburtLabel: string | null; alterLabel: string | null };

/** Textzeilen für UI: Trainer vollständiges Datum + Alter; Eltern/Spieler Tag.Monat. + Alter; Fans nur Alter. */
export function getPlayerBirthDisplayLines(
  viewerEffectiveRole: string,
  birthdateYmd: string | null | undefined,
): PlayerBirthDisplayLines {
  const raw = birthdateYmd != null ? String(birthdateYmd).trim() : '';
  if (!raw) return { geburtLabel: null, alterLabel: null };

  const mode = getPlayerBirthPrivacyMode(viewerEffectiveRole);
  const age = getAge(raw);
  const alterLabel = age != null ? `Alter: ${age} Jahre` : null;

  if (mode === 'trainer_view') {
    const full = formatDateFull(raw);
    return {
      geburtLabel: full != null ? `Geboren: ${full}` : null,
      alterLabel,
    };
  }
  if (mode === 'family_view') {
    const short = formatBirthdayShort(raw);
    return {
      geburtLabel: short != null ? `Geburtstag: ${short}` : null,
      alterLabel,
    };
  }
  return { geburtLabel: null, alterLabel };
}
