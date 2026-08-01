# STEP 5 – Spielerübernahme im Saison-Assistenten (Join-Modell)

**Umgebung:** Staging only (`acbaecjzoabafbsjrzvr`)  
**Branch:** `cursor/season-player-transfer-join` → `develop`  
**main / Live:** unverändert

## Ziel

Spieler beim Saisonwechsel wieder auswählen und übernehmen — **ohne** Player-Duplikate und **ohne** Verschieben über `UPDATE players.team_season_id` als Transfer-Mechanismus.

## Transfer-Mechanismus: alt vs. neu

| | Alt (gesperrt / STEP 2) | Neu (STEP 5) |
|--|-------------------------|--------------|
| Quelle | `players.team_season_id` | `team_season_players` (alte Season) |
| Aktion | `UPDATE players.team_season_id` → neue Season | `INSERT/UPSERT team_season_players` (gleiche `player_id`) |
| Alter Kader | geleert / unsichtbar | bleibt (Soft-Lock lesbar) |
| Duplikat-Schutz | n/a (Verschieben) | `UNIQUE(player_id, team_season_id)` + `ON CONFLICT` |
| Stats / Matches | blieben an Events, aber Kader-Historie kaputt | bleiben an alten Events; neuer Kader startet ohne Stats |

## Compat-Regel (zentral in `syncPlayersTeamSeasonIdCompat`)

1. Aktive Ziel-Season **darf** `players.team_season_id` setzen.
2. **Draft** überschreibt **keine** aktive Compat-Zuordnung.
3. Quell-`team_season_players`-Zeilen bleiben bestehen.
4. Compat ist **nicht** Source of Truth für Saisonhistorie.

## App-Änderungen

| Datei | Änderung |
|-------|----------|
| `src/lib/seasonTransition.ts` | Join-Transfer, Auswahl, Upsert, Compat nach Activate |
| `src/components/season/SeasonTransitionWizard.tsx` | Option wieder an (Default AN wenn Join ok); Alle/Keine/Checkboxen |
| `src/pages/SeasonManagementPage.tsx` | `sourceTeamSeasonId`; ÖFB-Platzhalter unverändert |
| `src/lib/rosterService.ts` | Compat-Regel; Typing |
| `src/lib/featureFlags.ts` | `ROSTER_JOIN_V1` Default **true** (Multi-Season sichtbar) |
| `src/lib/seasonPreparation.ts` | veraltete Transfer-TODOs entfernt |
| `.env.example` | Flag-Doku angepasst |

### Wizard-Verhalten

- **close_and_create** + Join verfügbar → „Spieler übernehmen“ aktiv, Default **AN**, Kader-Checkboxen (Alle / Keine / einzeln).
- Join nicht verfügbar → Option deaktiviert + Hinweis.
- **prepare** → Spielerübernahme weiter aus (keine Compat-Überschreibung durch Draft).
- Staff-Flow unverändert (keine Staff-Duplikate).

### Nicht kopiert

Spiele, Tore, Minuten, Trainingsquote, Attendance, Turnierstatistik, LiveMatch-Daten, saisonbezogene Ergebnisse.

### Kopiert (saisonbezogen)

`jersey_number`, `position`, `is_laz_player`, Start-`status`/`is_active`, `joined_at` = Wechselzeitpunkt.

## Staging-Smoke U11 → U12 (SQL, gleiche Semantik wie App-Upsert)

**Quelle:** `55cb9ae9-aa47-4ae5-8bb4-77d100693e1c` (U11 2025/26)  
**Ziel:** `b7f20267-012a-4e55-8bb4-77d100693e12` (U12 2026/27)

### Vorher

| Metric | Wert |
|--------|------|
| players | 15 |
| team_season_players U11 | 15 |
| guardians | 11 |
| player_users | 34 |
| U11 matches | 18 |
| U11 memberships | 46 |

### Nachher (Tests A–N)

| Test | Erwartung | Ergebnis |
|------|-----------|----------|
| A players count | 15 → 15 | **15** ✓ |
| B U11-Kader Join | 15 sichtbar | **15** ✓ |
| C U12-Kader Join | 15 sichtbar | **15** ✓ |
| D gleiche player_ids | 15/15 MATCH | **15 MATCH, 0 only** ✓ |
| E Guardians | unverändert | **11** ✓ |
| F player_users | unverändert | **34** ✓ |
| G alte U11 Spiele/Stats | unverändert | matches **18**, event_attendance **63** ✓ |
| H neue U12 Stats | starten bei 0 | matches **0**, event_attendance **0** ✓ |
| I Trainingsquote U11 | unverändert | Attendance an U11-Events **63** ✓ |
| J Trainingsquote U12 | keine alten Werte | Attendance **0** ✓ |
| K MatchPreparation U12 | Kader via `listRoster(Join)` | Code-Pfad Join; Flag default an ✓ |
| L Turnierkader U12 | wie K | Code-Pfad unverändert ✓ |
| M Soft-Lock U11 | archived | **archived** / U12 **active** ✓ |
| N Doppelklick | keine Duplikate | tsp U12 rows **15** nach 2× Upsert ✓ |

Compat: 15 Spieler auf U12, 0 noch auf U11-Compat.

## PlayerProfile / späterer Saisonfilter

- `PlayerProfileModal` akzeptiert optional `teamSeasonId` und nutzt sonst `player.team_season_id` (Compat).
- Mit Multi-Season-Membership öffnet das Profil weiter (eine `players`-Row).
- **Später nötig:** Stats/Trainingsquote immer mit **explizitem** `teamSeasonId` aus dem Team-Kontext (nicht nur Compat). UI-Saisonfilter: Gesamt vs. Season — noch nicht gebaut (bewusst out of scope).

## ÖFB-Platzhalter

Nach erfolgreichem Abschluss zeigt die Saisonverwaltung weiter „ÖFB-Spielplan importieren“ (**Demnächst**). Späterer ÖFB-Kaderimport soll bei bestehendem Player nur zusätzliche `team_season_players`-Zeilen anlegen.

## Out of scope (bewusst)

Kein ÖFB-Parser, kein Statistik-Saisonfilter-UI, kein Trainingsmodul, keine Live-Migration, `players.team_season_id` bleibt, keine LiveMatch-/Turnier-Engine-Änderungen, **kein main/Live**.

## Bugfix: Join-first Read (historischer Kader)

**Ursache:** `listRoster` konnte über Flag/localStorage auf Legacy (`players.team_season_id`) fallen.
Nach Transfer zeigt Compat auf U12 → Soft-Lock-U11 UI = 0 trotz 15 Join-Zeilen.

**Neue Regel:**
1. Join-Read versuchen (außer Hard-Disable `VITE_ROSTER_JOIN_V1=false`)
2. Erfolg → Join (auch Count 0)
3. Nur bei technischem Fehlen der Join-Struktur → Legacy
4. `localStorage` darf Join **nicht** abschalten

## Offene Risiken

1. Staging-Smoke war SQL-äquivalent zum Upsert; UI-Wizard auf Staging nach Deploy noch einmal manuell klicken.
2. Hard-Disable via Env zeigt Soft-Lock-Kader weiterhin leer (bewusstes Notfall-Rollback).
3. Parent/Player-Membership-Spiegelung im App-Transfer ist MVP (alle parent/player der Quelle); Teilauswahl filtert Memberships noch nicht fein.
4. Live (`main`) hat dieses Modell noch nicht — kein Merge ohne eigenen Go-Live-Plan.

## Qualität

- `npm run typecheck`
- `npm run build`
