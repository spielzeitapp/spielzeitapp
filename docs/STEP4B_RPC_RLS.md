# STEP 4B – RPC / RLS auf team_season_players

Staging: `acbaecjzoabafbsjrzvr` · Migration `20260801140000_roster_join_rpc_rls.sql`  
**Live/main nicht angefasst.**

## Inventar → Umstellung

| Objekt | Alt | Neu | Risiko |
|--------|-----|-----|--------|
| `get_team_training_participation_pct` | `players.team_season_id` | `team_season_players` (active) | mittel – Quote muss identisch bleiben |
| `get_team_player_parent_links` | `players.team_season_id` | Join + Saisonfelder aus tsp | niedrig |
| `get_team_player_app_status` | `players.team_season_id` | Join | niedrig |
| RSVP `event_attendance_*_player` | `p.team_season_id = e.ts` | `player_in_team_season(p, e.ts)` | mittel |
| `players` Staff-RLS | `ms.ts = players.ts` | `staff_can_access_player` (Join+Compat) | hoch |
| `player_profiles` Coach | `m.ts = pl.ts` | `staff_can_access_player` | mittel |
| Avatar/Cutout Storage | `p.ts = path ts` | Join (+ Compat) | niedrig – keine Medienmigration |
| `can_manage_player_login` | Staff of `pl.ts` | `staff_can_access_player` | niedrig |
| `fetchPlayerIdsForUserInTeamSeason` | players query | Join + Compat-Fallback | niedrig |
| Onboarding Parent/Player | players query | `listRoster` | niedrig |

## Helpers

- `player_in_team_season(player_id, team_season_id)`
- `staff_can_access_player(player_id)` — Join bevorzugt, Compat-OR

## Storage

Pfad bleibt `{teamSeasonId}/{playerId}.*`. Policy akzeptiert Join-Membership für diese Season. Keine Bulk-Medienmigration.

## Notifications

Recipient-Listen über Memberships unverändert.  
`fetchPlayerIdsForUserInTeamSeason` (Has-Responded / Dedup) nutzt Join.  
Staging: Outbound weiter disabled.

## ALT/NEU U11 SPG Rohrbach 2025/26

| Bereich | Ergebnis |
|---------|----------|
| Kader (15) | **MATCH** |
| Aktive Kader für Quote (12) | **MATCH** |
| Trainingsquote (62 %) | **MATCH** |
| Parent Links (Kader-Quelle) | **MATCH** (gleiche player_ids; Guardians 11 unverändert) |
| Player App Status | **MATCH** (gleiche Kaderbasis) |
| RSVP-Policy | umgestellt; historische Attendance unverändert |
| Staff-Zugriff | Join+Compat |
| Notification-Empfänger (membership) | unverändert; Roster-Filter Join |

## Tests A–J

| | |
|--|--|
| A Team/Kader | ✓ (`listRoster` / Dual-Read) |
| B Trainingsquote | ✓ 62 = 62 |
| C Parent sieht Spieler | ✓ Onboarding → `listRoster` |
| D Player-App-Zuordnung | ✓ RPC Join |
| E Zu-/Absage | ✓ Policy `player_in_team_season` |
| F Trainerzugriff | ✓ `staff_can_access_player` |
| G MatchPreparation | ✓ `usePlayers` |
| H LiveMatch Roster | ✓ Input unverändert |
| I Turnierkader | ✓ `usePlayers` |
| J Flag false Rollback | ✓ Default false; Compat-Spalte bleibt |

Spielerübernahme Assistent: **weiter gesperrt**.

## Verbleibende Legacy-Abhängigkeiten

- `players.team_season_id` Compatibility-Spalte + Dual-Write
- Login-Credentials / Access-Invites speichern weiter `team_season_id` vom Compat-Feld
- Manche Feed-Lookups optional Season-Scope auf players (nicht kritisch für Kader-SoT)
- Keine Entfernung der Spalte in diesem Step
