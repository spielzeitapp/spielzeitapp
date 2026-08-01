# Team-Logos (lokal)

Logos werden unter `/logos/<dateiname>` ausgeliefert (relative Pfade, keine Domain im Code).

## Source of Truth – unser Team (SPG Rohrbach)

- **Match-/Spielbericht-Logo:** `spg-rohrbach.png` (Slug `spg-rohrbach`)
- Code: `getOurTeamLogoUrl()` / `getClubLogo(..., { ourTeam: true })`
- **Hinweis:** `spg-rohrbach.png` ist byte-identisch mit `nsg-goelsental.png` (NSG-Gölsental-Wappen der Nachwuchs-SPG). Das ist das vorgesehene Vereinslogo für Match-Darstellung.
- Altbestand (nicht Mapping-Ziel): `spg-rohrbach-TRANSPARENT.png`, `spg-rohrbach-WEISS - Kopie.png` (USC Kaschütz Rohrbach)

## Gegner / Fallback

- Gegner: u. a. `usg-alpenvorland.png`, `skn-stpoelten-a.png`, …
- Fallback: `placeholder-shield-a.png`

Mapping siehe `src/lib/teamLogos.ts`.
