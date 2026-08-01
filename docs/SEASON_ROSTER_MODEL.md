# Saisonfähiges Spieler-/Kadermodell — Analyse & Migrationsplan

> STEP 2.5 — Nur Analyse. **Keine Implementierung, keine Migration ausführen.**  
> Stand: 2026-08-01 · Branch-Kontext: develop / Staging

## Kernurteil

Das gewünschte Modell ist richtig und zwingend. Heute sind Stamm und Kader dieselbe Zeile (`players.team_season_id`). Deshalb leert jeder Transfer den alten Kader.

Legacy-MySQL hat bereits `team_season_players` — der Name ist in Supabase frei und passt semantisch. Die React-App nutzt den Legacy-Join **nicht**.

---

## A. Ist-Datenmodell

```text
players (1 Zeile = Stamm + aktuelle Saison-Mitgliedschaft)
  id (dauerhaft)
  team_season_id          ← Kaderzuordnung (1:1)
  first_name, last_name
  jersey_number, position
  status / is_active
  is_laz_player
  is_injured, injured_since, injured_until
  avatar_url / cutout_url (teilweise auch Neben-Tabellen)

player_profiles.birthdate     ← Geburtsdatum (primär)
player_avatars                ← Foto (App-Nutzung)
player_guardians / player_users  ← an player_id

team_seasons ← events.team_season_id
             ← matches.team_season_id
             ← memberships.team_season_id

matches → match_lineup / match_lineup_snapshots / match_events  (player_id)
events  → event_attendance                                      (player_id)
        → tournament_squad / tournament_matches                 (player_id)
```

| Bereich | Season-Bindung heute |
|---------|----------------------|
| Kader | nur `players.team_season_id` |
| Spiele / Live / Prep | `matches.team_season_id` + `player_id` |
| Trainings / RSVP | `events.team_season_id` + `event_attendance.player_id` |
| Turniere | Event/Match-Season + `tournament_squad.player_id` |
| Guardians/Users | nur `player_id` (stabil) |
| Kapitän | keine DB-Spalte (nur Live-UI) |

Kein Supabase-`CREATE TABLE players` in den Migrations — Basistabelle vor Repo-Zeit; Spalten kommen über ALTERs.

Siehe auch: `docs/SEASON_ROSTER_LIMITATION.md` (bekannte Grenze des aktuellen Transfers).

---

## B. Abhängigkeiten von `players.team_season_id`

### App / Hooks (kritisch)

| Stelle | Nutzung |
|--------|---------|
| `src/hooks/usePlayers.ts` | Zentraler Kader-Loader `.eq('team_season_id', …)` |
| `TeamPage` | Insert/Update/Delete Kader |
| `PlayerOnboardingPage` / `ParentOnboardingPage` | Spieler-Suche im Team |
| `seasonTransition.transferPlayersToSeason` | `UPDATE … SET team_season_id` |
| `notifications/users.ts` | Push-Empfänger aus Kader |
| `ensureLineupFeedPost.ts` | optional Season-Scope bei Name/Nummer |
| Feed/Stats-Loader | meist `events`/`matches.team_season_id`; Kader oft indirekt via `usePlayers` |

**Screens über `usePlayers(teamSeasonId)`:** Team, Schedule, EventDetail, MatchPreparation, MatchLineup, MatchSetup, LiveMatch, MatchDetail, Tournament-Squad/-Detail, Training-Detail, TrainerProfile, JugglingChallenge, …

### SQL-RPCs / RLS

| Objekt | Abhängigkeit |
|--------|--------------|
| `players_*` Staff-RLS (`20260528135200_…`) | `ms.team_season_id = players.team_season_id` |
| `get_team_training_participation_pct` | Kader-Loop `FROM players WHERE team_season_id = …` |
| `get_team_player_parent_links*` / `get_team_player_app_status` | Filter über `p.team_season_id` |
| RSVP-Policies | `p.team_season_id = e.team_season_id` |
| Avatar/Cutout Storage-RLS | Path-Segment = `team_season_id` |

### Legacy (nicht App-Runtime)

`spielzeitapp_api/schema/schema.sql` + `routes/team_seasons.php` (`clone-roster`) — Join existiert schon; React-App nutzt ihn nicht.

Unterschiede Legacy vs. geplantes Supabase:

| | Legacy MySQL | Geplantes Supabase |
|--|--------------|-------------------|
| IDs | `VARCHAR(32)` | `uuid` |
| Nummer | `shirt_number` | `jersey_number` (App-Konvention) |

---

## C. Zielmodell

```text
players                          = dauerhafter Stamm (player_id stabil)
team_season_players              = Kader pro Saison
  id uuid PK
  player_id        → players.id
  team_season_id   → team_seasons.id
  jersey_number
  position
  status           (active|paused|archived)  -- Kaderstatus der Saison
  is_active
  is_laz_player    -- saisonbezogen (siehe D)
  joined_at, left_at
  UNIQUE (player_id, team_season_id)
```

**Name `team_season_players`:** empfohlen. Keine Kollision in Supabase.

**Übergang:** `players.team_season_id` bleibt vorerst als Compatibility-Spalte (Dual-Write / Dual-Read), **nicht** sofort droppen.

Optional (nicht zwingend Step 1):

- View `v_team_season_roster` = Join players + team_season_players
- Später: „aktuelle“ Membership nur aus Join ableiten

---

## D. Stammdaten vs. Saisondaten

| Feld | Empfehlung | Begründung |
|------|------------|------------|
| `id`, Name | dauerhaft `players` | Profil-Identität |
| Geburtsdatum | dauerhaft `player_profiles` | bereits getrennt |
| Foto / Cutout | dauerhaft (langfristig `player_id`-Pfad) | Storage heute oft season-scoped → Compat nötig |
| Guardians / Users / Invites | dauerhaft an `player_id` | unverändert |
| Mannschaft / Altersklasse | über `team_seasons` (+ teams) | nicht am Spieler |
| Rückennummer | saisonbezogen Join | wechselt oft mit Altersklasse |
| Position | saisonbezogen Join | kann wechseln |
| Kaderstatus | saisonbezogen Join | „pausiert in U12“ ≠ Stamm gelöscht |
| LAZ | saisonbezogen Join | jahrgangsbezogen; Startwert kopierbar |
| Verletzung | dauerhaft `players` (aktueller Zustand) | Historie oft via Attendance/RSVP |
| Kapitän | optional Join oder Match-only | heute keine DB-Spalte |
| Eintritt/Austritt | `joined_at` / `left_at` | saisonbezogen |
| ÖFB-externe IDs | dauerhaft am player (später) | Matching über Saisons |

Beim Saisonwechsel: ausgewählte Join-Felder als **Startwerte** kopieren (Nummer, Position, LAZ, Status=active), danach unabhängig editierbar.

---

## E. Statistik-Zuordnung nach Saison

**Source of Truth = Rohdaten (Variante A).** Aggregate nur optional für Performance.

| Metrik | Quelle | Season-Filter heute | Nach Zielmodell |
|--------|--------|---------------------|-----------------|
| Spiele / Einsätze / Startelf / Minuten / Tore / Assists | `matches` + lineup/snapshots + `match_events` | `matches.team_season_id` | unverändert; Profil „Gesamt“ = alle Seasons des `player_id` |
| Trainingsquote / Zu-/Absagen | `events` + `event_attendance` | `events.team_season_id` + Kader-RPC | Kader aus Join; Attendance bleibt `player_id` |
| Turniere | tournament_* + matches | Event/Match-Season | unverändert |
| Challenges | challenge_* | prüfen | `player_id` + optional Season |

**Wichtig:** Beim Wechsel keine Stats kopieren. U11-Werte bleiben an U11-Matches/Events.

**Profil-UI (Soll):**

- Filter: Gesamt \| 2026/27 · U12 \| 2025/26 · U11
- Seasons = alle `team_season_players` des Spielers (+ Labels)
- `usePlayerStats(playerId, teamSeasonId | null)` — `null` = Gesamt

Heute: `usePlayerStats(playerId, teamSeasonId)` nur **eine** Season; Gesamt fehlt.

---

## F. Migrationsplan (kleine Steps)

Alles zuerst **Staging**. Keine Live-/Turnier-Engine-Änderung in Early Steps.

### Step 0 – Vorbereitung

- Inventur Staging: Anzahl `players`, Duplikat-Check Name+Birthdate, Null-`team_season_id`
- Feature-Flag `ROSTER_JOIN_V1=false`
- Backup/Snapshot Staging-DB

### Step 1 – Schema anlegen (additiv)

- `CREATE TABLE team_season_players` + UNIQUE + FKs + Indizes
- RLS analog Memberships (Staff read/write der Season; Parents lesen eigene verknüpfte Spieler)
- Keine App-Änderung außer optionaler Probe-Select

### Step 2 – Backfill

```sql
INSERT INTO team_season_players (
  player_id, team_season_id, jersey_number, position, status, is_active, …
)
SELECT
  id, team_season_id, jersey_number, position, status, is_active, …
FROM players
WHERE team_season_id IS NOT NULL
ON CONFLICT DO NOTHING;
```

Validierung: Count Join = Count players mit Season; Stichproben Kader vs. Alt.

### Step 3 – Compatibility-Schicht

- View oder Repo-Helper `listRoster(teamSeasonId)` liest Join (+ players-Stamm)
- Dual-Write: Insert/Update schreibt Join **und** hält `players.team_season_id` = „aktuelle“ Membership
- RPCs schrittweise: Training-% / Parent-Links / App-Status → Join

### Step 4 – App Dual-Read

- `usePlayers` auf Join umstellen (Feature-Flag)
- TeamPage Create: neuer Player-Stamm + Join-Row
- Soft-Lock archived: Join-Writes blocken

### Step 5 – Season-Assistent

- `transferPlayers` → `INSERT team_season_players` für ausgewählte IDs (Startwerte kopieren)
- Quell-Kader unverändert
- Spieler-Übernahme wieder aktivierbar (siehe J)

### Step 6 – RLS / Storage / RSVP

- Staff-Policies über Join-Membership
- RSVP: Join-Zeile für Event-Season
- Storage: neue Pfade `players/{player_id}/…`; alte Season-Pfade weiter lesbar

### Step 7 – Profil Gesamt + Saisonfilter

- Stats-API: `teamSeasonId` optional
- UI-Filter wie gewünscht

### Step 8 – Aufräumen (spät, eigener Release)

- Dual-Write abschalten
- `players.team_season_id` deprecated → nullable → später drop
- Erst nach längerer Staging+Live-Beobachtung

**Nicht in diesem Plan:** ÖFB-Parser. Matching-Design: Match auf `players` → nur Join-Row; Flags ✅➕🔄⚠️.

---

## G. Rollback-Plan

| Phase | Rollback |
|-------|----------|
| Nach Step 1–2 | Tabelle droppen oder ignorieren; App unverändert |
| Nach Dual-Write | Flag aus; weiter nur `players.team_season_id` |
| Nach Dual-Read | Flag zurück auf Alt-Query; Join bleibt als Archiv |
| Datenfehler Backfill | Join truncate + erneut aus `players.team_season_id` |
| Nie ohne Backup | Staging-Snapshot vor Step 2 und vor Live-Apply |

**Garantie:** Solange `players.team_season_id` existiert und befüllt wird, ist Full-Rollback der App möglich ohne Verlust an Spielen/Trainings/Guardians.

---

## H. Betroffene UI-/Service-Komponenten

| Prio | Komponente | Änderung |
|------|------------|----------|
| P0 | `usePlayers` + `TeamPage` | Join-basiert laden/schreiben |
| P0 | `seasonTransition` / Wizard | Insert Join statt UPDATE |
| P0 | RLS + Training-RPC + Parent-Link-RPCs | Join |
| P1 | Onboarding Parent/Player | Kader-Suche |
| P1 | `usePlayerStats` / `PlayerProfileModal` | Gesamt + Saisonfilter |
| P1 | Training-Ranking | Kader aus Join |
| P2 | MatchPrep / Lineup / LiveMatch / TournamentSquad | nur Roster-Quelle (Engine unverändert) |
| P2 | Notifications / Feed-Lookups | Kader-IDs aus Join |
| P3 | TeamSwitcher | keine Players-Query |
| — | LiveMatch-Engine / Turnierlogik | **nicht anfassen**; nur Roster-Input |

---

## I. Risiken

1. **RLS-Regression** — Staff sieht Kader nicht / Parents verlieren RSVP → intensive Staging-Tests
2. **Storage-Pfade** — Avatare an Season gebunden; Profil über Seasons kann brechen
3. **Dual-Write-Drift** — Join und `players.team_season_id` divergieren → Monitoring-Query
4. **„Aktuelle“ Season** bei Multi-Membership (Draft+Active) — Regel festlegen
5. **Verletzung/LAZ historisch** — LAZ klar saisonbezogen halten
6. **Jersey unique pro Season** — Constraint `(team_season_id, jersey_number)` wo not null
7. **Performance** — Join + View ok; Aggregate vorerst unnötig
8. **Legacy-API-Namensgleichheit** — MySQL vs. Supabase in Docs klar trennen

---

## J. Wann Spielerübernahme im Assistenten wieder aktivieren?

**Erst nach:**

1. Join-Tabelle live auf Staging  
2. Backfill validiert  
3. `usePlayers` + TeamPage + Soft-Lock auf Join  
4. Assistent schreibt **nur** Join-Rows (kein `UPDATE players.team_season_id` mehr für Transfer)  
5. Manueller Test: alter U11-Kader sichtbar + neuer U12-Kader + gleiche `player_id` + Guardians ok + Stats U11 unverändert  

Dann: Default „Spieler übernehmen“ wieder sinnvoll; Warnhinweis umformulieren.

**Nicht aktivieren**, solange Transfer noch `UPDATE players.team_season_id` macht.

---

## ÖFB-Matching (nur Design)

Match-Pipeline gegen `players` (Name, Geburtsdatum, ggf. ÖFB-ID):

| Flag | Bedeutung | Aktion |
|------|-----------|--------|
| ✅ | bestehender Spieler | nur `team_season_players` |
| ➕ | neuer Spieler | `players` + Join |
| 🔄 | unsicher | Review-UI |
| ⚠️ | Dublette | manuell mergen, nie auto-duplizieren |

---

## Nächster STEP (Freigabe nötig)

**STEP 3:** Schema-Migration + Backfill **nur Staging** + Feature-Flag — noch ohne Assistenten-Reaktivierung und ohne Live-/Turnier-Engine-Touch.

→ Ergebnis: `docs/STEP3_ROSTER_JOIN_STAGING.md` (Staging angewandt, MATCH 15/15).
