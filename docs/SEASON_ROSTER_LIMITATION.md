# Saisonwechsel – bekannte Grenzen (ohne Kader-Migration)

## Datenmodell

| | Tabelle |
|--|---------|
| Spieler-Stamm | `players` (inkl. `team_season_id`) |
| Kaderzuordnung | dieselbe Spalte `players.team_season_id` |
| Eltern/Spieler-Login | `player_guardians` / `player_users` an `player_id` |

Es gibt **kein** App-Join `team_season_players` (nur im Legacy-MySQL-Schema).

## Spieler übernehmen (close_and_create)

Aktuell: `UPDATE players SET team_season_id = <neu>` bei gleicher `player_id`.

| Folge | |
|-------|--|
| Keine doppelten Spieler | ✓ |
| Guardians/Users bleiben gültig | ✓ (hängen an `player_id`) |
| Alter Kader der Quell-Saison | **leer** nach Transfer |
| Historische Spiele/Events | bleiben über `player_id` lesbar |

**Produktentscheidung STEP 2:** Spieler-Übernahme ist im Assistenten **standardmäßig aus**, mit Warnhinweis. Freigabe für produktiven Transfer erst nach Join-Tabelle.

## Empfohlene spätere Schema-Erweiterung

```text
team_season_players (team_season_id, player_id, …)
```

Dann: Stamm bleibt stabil, Kader pro Saison unabhängig, alte Saison behält Roster.

Keine Migration in diesem Step.
