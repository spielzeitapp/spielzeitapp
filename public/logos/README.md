# Team-Logos (lokal)

Logos werden unter `/logos/<dateiname>` ausgeliefert (relative Pfade, keine Domain im Code).

## Source of Truth – unser Team (SPG Rohrbach)

- **Match-/Spielbericht-/PDF-Logo:** `nsg-goelsental.png` (Slug `nsg-goelsental`)
- Code: `getOurTeamLogoUrl()` / `getClubLogo(..., { ourTeam: true })`
- Anzeigename bleibt „SPG Rohrbach“; Wappen = NSG Gölsental (schwarz/rot/rund).
- Altbestand (nicht Mapping-Ziel): `spg-rohrbach.png` (historisch, ggf. identisch), `spg-rohrbach-TRANSPARENT.png`, `spg-rohrbach-WEISS - Kopie.png`

## Gegner / Fallback

- Gegner: u. a. `usg-alpenvorland.png`, `skn-stpoelten-a.png`, …
- Fallback: `placeholder-shield-a.png`

Mapping siehe `src/lib/teamLogos.ts`.
