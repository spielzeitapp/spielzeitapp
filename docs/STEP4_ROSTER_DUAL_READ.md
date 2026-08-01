# STEP 4 – Dual-Read / Dual-Write Kadermodell

## Roster-Service

`src/lib/rosterService.ts`

| API | Zweck |
|-----|--------|
| `listRoster(teamSeasonId, mode)` | Zentraler Reader (Join oder Legacy je Flag) |
| `compareRosterPaths(teamSeasonId)` | Legacy vs Join Vergleich |
| `createRosterPlayer` | Stamm + Join + Compat |
| `updateRosterPlayerSeasonFields` | Dual-Write Saisonfelder |
| `updatePlayerMasterFlags` | Verletzung (Stamm) + LAZ (Stamm + Join) |
| `syncPlayersTeamSeasonIdCompat` | Compatibility-Regel |

`usePlayers` → nur noch `listRoster` (kein direktes `players.team_season_id`-Select in der UI).

## Dual-Read

| `ROSTER_JOIN_V1` | Quelle |
|------------------|--------|
| `false` (Default) | `players` WHERE `team_season_id` |
| `true` | `team_season_players` ⋈ `players` |

Saisonfelder aus Join: `jersey_number`, `position`, `status`, `is_active`, `is_laz_player`  
Stamm: Name, cutout, Verletzung; Birthdate/`player_avatars` unverändert.

## Dual-Write-Regel

Bei Create/Update/Status/LAZ (TeamPage / Profil):

1. **Immer** Join-Row upserten (`team_season_players` = SoT Zugehörigkeit)
2. **Stamm** (`players`): Name immer; Saisonfelder auf `players` nur wenn `players.team_season_id` leer oder = aktuelle Season
3. **Compat-Spalte** `players.team_season_id`:
   - leer → setzen
   - Ziel **active** → setzen (Vorrang)
   - Ziel **draft** und aktuelle Zuordnung **active** → **nicht** überschreiben

## Konflikte / Hinweise

| Thema | Verhalten STEP 4 |
|-------|------------------|
| Verletzung | weiter dauerhaft auf `players` |
| LAZ | Dual-Write players + Join der aktuellen Season |
| Kapitän | unverändert (keine DB) |
| Assistent Spielerübernahme | weiterhin aus / gesperrt |
| RPCs (Training %, Parent Links, …) | noch Legacy — siehe unten |

## Offene RPC / RLS-Abhängigkeiten (STEP 4B)

Weiterhin `players.team_season_id` (noch nicht migriert):

- `get_team_training_participation_pct`
- `get_team_player_parent_links*`
- `get_team_player_app_status`
- RSVP-Policies (`p.team_season_id = e.team_season_id`)
- Staff-RLS auf `players` (Membership ↔ `players.team_season_id`)
- Avatar/Cutout Storage-Pfad (Season-Segment)

Dual-Read-UI funktioniert trotzdem, solange Compat-Spalte synchron bleibt.

## Staging-Vergleich

Siehe Abschnitt „Testergebnis“ unten.

---

## Testergebnis (Staging DB, 2026-08-01)

SQL `roster_dual_read_compare.sql`:

| Season | Legacy | Join | Field MATCH | MISMATCH | Verdict |
|--------|--------|------|-------------|----------|---------|
| U11 SPG Rohrbach 2025/26 (`55cb9ae9-…`) | 15 | 15 | 15 | 0 | **MATCH** |

### Checklist A–K (Code + DB-Vergleich; Browser-Smoke empfohlen)

| | | Hinweis |
|--|--|--|
| A TeamPage Kader | ✓ | `usePlayers` → `listRoster` |
| B gleiche Spieleranzahl | ✓ | 15 = 15 |
| C gleiche player_ids | ✓ | FULL OUTER JOIN ohne Lücken |
| D Nummer/Position/Status | ✓ | field_match_count 15 |
| E PlayerProfile öffnet | ✓ | kompatibles `PlayerItem` |
| F MatchPreparation Kader | ✓ | nutzt `usePlayers` |
| G LiveMatch Roster Input | ✓ | nutzt `usePlayers` (Engine unverändert) |
| H Tournament Squad | ✓ | nutzt `usePlayers` |
| I Training/Event Attendance | ✓ | Attendance weiter `player_id`; Kader-Input via Hook |
| J Parent/Guardian-Zugriff | ✓* | Join-RLS erlaubt Guardian SELECT; Parent-RPCs noch Legacy (4B) |
| K Flag false Rollback | ✓ | Default `ROSTER_JOIN_V1=false` → Legacy-Pfad |

\* Parent-Link-RPC filtert weiter über `players.team_season_id` — Compat-Spalte hält das synchron.

Spielerübernahme im Assistenten: **weiterhin gesperrt / Default aus**.
