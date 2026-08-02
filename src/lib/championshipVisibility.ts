/**
 * Sichtbarkeit Meisterschafts-Fixtures (STEP 7B.2).
 * Nur published (oder NULL = normales Event) ist Eltern-seitig sichtbar.
 */

export type FixtureStatus = 'open' | 'agreed' | 'published';

/** open / agreed = nur Meisterschaftsverwaltung */
export function isInternalChampionshipFixture(
  fixtureStatus: string | null | undefined,
): boolean {
  const s = String(fixtureStatus ?? '')
    .trim()
    .toLowerCase();
  return s === 'open' || s === 'agreed';
}

/** Eltern/Termine/Home/ICS/Feed: normale Events (NULL) + published */
export function isParentVisibleFixtureStatus(
  fixtureStatus: string | null | undefined,
): boolean {
  return !isInternalChampionshipFixture(fixtureStatus);
}
