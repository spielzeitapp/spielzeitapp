# STEP 3 – Staging-Ergebnis: team_season_players

Angewendet auf: **Staging** `acbaecjzoabafbsjrzvr` (spielzeitapp-staging)  
Datum: 2026-08-01  
**Live / main / nsg nicht verändert.**

## Inventur (vor Migration)

| Metrik | Wert |
|--------|------|
| players gesamt | 15 |
| mit team_season_id | 15 |
| ohne team_season_id | 0 |
| Namens-Dubletten-Gruppen | 0 |
| Jersey-Duplikate pro Season | 0 |
| guardian_links | 11 |
| player_user_links | 34 |
| matches | 18 |
| events | 20 |
| match_events | 33 |
| event_attendance | 63 |

Spieler je Season:

| Team | Saison | Status | Count |
|------|--------|--------|-------|
| U11 SPG Rohrbach | 2025/26 | active | 15 |

## Nach Backfill

| Metrik | Wert |
|--------|------|
| players_with_season | 15 |
| team_season_players | 15 |
| delta | **0** |
| MATCH | **15** |
| MISMATCH | **0** |
| MISSING_ROSTER | **0** |
| Orphan Join-Rows | **0** |
| Guardians nachher | 11 (unverändert) |
| player_users nachher | 34 (unverändert) |
| matches/events/attendance | unverändert |

Stichprobe: alle 15 Spieler MATCH (gleiche `player_id`, gleiche `team_season_id`).

## Rollback

- App: `VITE_ROSTER_JOIN_V1` / `isRosterJoinV1Enabled()` = **false** (Default)
- `players.team_season_id` unverändert
- Tabelle kann ignoriert werden; optional `DROP TABLE team_season_players CASCADE`

## CLI-Hinweis

Supabase CLI wurde für diesen Step auf Staging gelinkt (`acbaecjzoabafbsjrzvr`).  
Vollständiges `db push` wegen Historie-Konflikt nicht genutzt; Migration per `db query -f` angewendet und in `schema_migrations` vermerkt.
