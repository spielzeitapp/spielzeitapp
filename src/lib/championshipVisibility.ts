/**
 * Sichtbarkeit Meisterschafts-Fixtures (STEP 7B.2 / 7B.2A).
 * Source of Truth für Home / Termine / ICS / Feed / Match Center.
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

/** Alias — gleiche Semantik wie isInternalChampionshipFixture */
export function isChampionshipFixtureInternal(
  fixtureStatus: string | null | undefined,
): boolean {
  return isInternalChampionshipFixture(fixtureStatus);
}

/** Eltern/Termine/Home/ICS/Feed: normale Events (NULL) + published */
export function isParentVisibleFixtureStatus(
  fixtureStatus: string | null | undefined,
): boolean {
  return !isInternalChampionshipFixture(fixtureStatus);
}

/** Alias */
export function isEventPubliclyVisibleByFixtureStatus(
  fixtureStatus: string | null | undefined,
): boolean {
  return isParentVisibleFixtureStatus(fixtureStatus);
}

export function isEventPubliclyVisible(event: {
  fixture_status?: string | null;
}): boolean {
  return isParentVisibleFixtureStatus(event.fixture_status);
}
