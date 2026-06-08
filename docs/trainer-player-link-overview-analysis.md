# Trainer-Übersicht Eltern- & Spieler-Verknüpfungen – Analyse

## Ziel

Trainer sollen unter der Teamverwaltung sehen können, welche Kader-Spieler bereits mit Eltern-Accounts und/oder eigenen Spieler-Accounts verknüpft sind — und welche noch fehlen. Diese Analyse beschreibt den Ist-Zustand in DB, Code und RLS; sie enthält **keine Implementierung**.

---

## Gefundene Tabellen

| Bereich | Tabelle | Wichtige Spalten | Zweck | Bemerkung |
|--------|---------|------------------|-------|-----------|
| Kader | `players` | `id`, `team_season_id`, `first_name`, `last_name`, `jersey_number`, `position`, `status`, `is_active`, `is_laz_player`, `cutout_url` | Spieler im Kader einer Saison | Basis für die Übersicht; Trainer lesen bereits (RLS Staff). Kein `user_id` auf dem Spieler. |
| User-Profil | `profiles` | `id` (= `auth.users.id`), `first_name`, `last_name`, `phone`, `email`, `avatar_url`, `is_admin` | Anzeige-/Kontaktdaten | `profiles.email` ist Kontaktfeld, nicht zwingend Login-E-Mail. Team-Kollegen lesbar (RLS `profiles_select_team_peers`). |
| Auth (indirekt) | `auth.users` | `id`, `email`, … | Supabase-Login | Client hat keinen direkten Lesezugriff; nur über RPC `find_user_id_by_email` (Staff). |
| Team-Rolle | `memberships` | `user_id`, `team_season_id`, `role` | Wer gehört zu welcher Saison mit welcher Rolle | Enum: `fan`, `parent`, `player`, `trainer`, `co_trainer`, `head_coach`. Sagt **nicht**, welcher Spieler verknüpft ist. |
| Globale Rolle | `user_roles` | `user_id`, `role` | App-weite Rolle (`fan`/`parent`/`player`/`trainer`/`admin`) | Von `useSession` geladen; getrennt von `memberships.role`. |
| Eltern↔Spieler | `player_guardians` | `user_id`, `player_id`, `created_at`, `verified_at`, `verified_by` | Eltern-Konto ↔ Kader-Spieler | **Kern-Tabelle** für Eltern-Verknüpfung. Mehrere Eltern pro Spieler möglich. |
| Spieler↔Account | `player_users` | `user_id`, `player_id`, `created_at` | Spieler-App-Konto ↔ Kader-Spieler | Für Self-RSVP / Spieler-App. **Kern-Tabelle** für Spieler-Verknüpfung. |
| Freigabe | `join_requests` | `id`, `user_id`, `team_id`, `requested_role`, `child_name`, `player_name`, `status`, `created_at` | Onboarding-Freigabe durch Trainer/Admin | Status: `pending` / `approved` / `rejected`. **Keine Migration im Repo** — Tabelle wird im Frontend genutzt, Schema vermutlich manuell/extern angelegt. |
| Saison | `team_seasons` | `id`, `team_id`, `season_id` | Verknüpfung Team ↔ Saison | Filter für Kader und Memberships. |
| Invite-/Codes | — | — | — | **Keine** dedizierte Tabelle (`player_code`, `invite_code`, `access_code`) gefunden. Verknüpfung läuft über Team+Spieler-Auswahl, nicht über Einladungscode. |

**Nicht gefunden / nicht relevant:** `user_player`, `linked_players`, `family`, `player_link`, `player_profile`, `player_code`, `claim`.

**Hinweis `schema.sql`:** Enthält ein älteres MySQL-V1-Schema ohne Supabase-Verknüpfungstabellen — für die aktuelle App **nicht** maßgeblich.

---

## Bestehende Verknüpfungslogik

### Ablauf: Registrierung & Rollenwahl

1. `RegisterPage` → nach Sign-up Weiterleitung zu `/app/role-choice`
2. `RoleChoicePage` — Auswahl: Elternteil / Fan / Spieler (`setPreviewRole`)
3. `InternalLayout` — Onboarding-Gate leitet neue Nutzer je nach Rolle weiter; Staff (`trainer`/`admin`/`co_trainer`/`head_coach`) wird nicht blockiert

### Eltern-Verknüpfung

**Dateien:** `src/pages/ParentOnboardingPage.tsx`, `src/app/layout/InternalLayout.tsx`, `src/pages/ProfilePage.tsx`, `src/hooks/useAvailabilityPermissions.ts`

**Ablauf (`ParentOnboardingPage.handleSave`):**

1. Nutzer wählt `team_season` und Kader-Spieler aus öffentlicher Spielerliste
2. `memberships` upsert mit `role: 'parent'` (außer bestehende Staff-Membership bleibt)
3. `player_guardians` insert `(user_id, player_id)` — Duplikat-Check vorher
4. `join_requests` insert mit `requested_role: 'parent'`, `child_name`, `status: 'pending'`
5. Redirect `/app/home` + `window.location.reload()`

**Onboarding-Skip (Eltern):** `InternalLayout` prüft `memberships` mit Rolle `parent` **und** mindestens eine Zeile in `player_guardians`.

### Spieler-Verknüpfung (Spieler-App)

**Dateien:** `src/pages/PlayerOnboardingPage.tsx`, `src/pages/JoinRequestsAdminPage.tsx`, `src/auth/useSession.tsx`

**Ablauf (`PlayerOnboardingPage.handleSave`):**

1. Nutzer wählt `team_season` und Kader-Spieler
2. **Nur** `join_requests` insert mit `requested_role: 'player'`, `player_name`, `status: 'pending'`
3. **Kein** `player_users`-Insert im Frontend
4. Redirect `/app/home`

**Freigabe (`JoinRequestsAdminPage.updateStatus` bei `approved`):**

1. `memberships` upsert mit `role: 'parent'` oder `'player'` für alle `team_seasons` des Teams
2. `join_requests.status` → `approved`
3. **Kein** `player_users`-Insert bei Spieler-Freigabe
4. **Kein** nachträgliches `player_guardians`-Insert bei Eltern-Freigabe (wurde bereits im Onboarding angelegt)

**Lücke im Ist-Zustand:** `player_users` wird im gesamten App-Code **nur gelesen**, nie geschrieben. Die Tabelle existiert (Migration `20260308100000_rsvp_permissions_player_users.sql`), Verknüpfung müsste manuell oder über fehlende Logik erfolgen. Für die Trainer-Übersicht relevant: Spieler-App-Status hängt an `player_users`, nicht allein an `memberships.role = 'player'`.

### Nutzung der Verknüpfungen in der App

| Datei | Funktion | Nutzung |
|-------|----------|---------|
| `useAvailabilityPermissions.ts` | Parent/Player player_ids laden | `player_guardians` / `player_users` |
| `SchedulePage.tsx` | RSVP-Berechtigung | gleiche Tabellen |
| `EventDetailPage.tsx` | Zu-/Absage pro Rolle | gleiche Tabellen |
| `ProfilePage.tsx` | Verknüpfte Kinder anzeigen | `player_guardians` → `players` |
| `lib/notifications/users.ts` | Push-Zielgruppen (service role) | beide Tabellen |
| `Header.tsx` | Badge pending Anfragen | `join_requests` count |
| `JoinRequestsAdminPage.tsx` | Trainer-Freigabe | `join_requests` + `memberships` |

### „Anmeldung per Spielercode“

**Ergebnis:** Es gibt **keinen** Spielercode-/Invite-Code-Flow im Projekt. Verknüpfung erfolgt über:

- Registrierung + Rollenwahl
- Auswahl Team + Spieler aus Kaderliste (Onboarding)
- Optional Trainer-Freigabe über `join_requests` (`/admin/join-requests`)

---

## Rollen & Rechte

### Rollen im System

| Ebene | Rollen | Quelle |
|-------|--------|--------|
| `memberships.role` (team) | `fan`, `parent`, `player`, `trainer`, `co_trainer`, `head_coach` | Postgres-Enum `membership_role` |
| `user_roles.role` (global) | `fan`, `parent`, `player`, `trainer`, `admin` | `useSession.fetchUserRole` |
| System-Admin | `profiles.is_admin` oder `user_roles.role = 'admin'` | `is_admin()` |

Frontend normalisiert `co_trainer` / `head_coach` oft auf `trainer` (`src/lib/roles.ts`, `useSession.normalizeRole`).

### RLS — was Trainer aktuell lesen dürfen

| Tabelle | Trainer-Zugriff heute | Policy / Mechanismus |
|---------|----------------------|----------------------|
| `players` | **Ja** (eigenes Team, inkl. pausierte) | `players_select_staff_with_paused` — Staff-Rollen in `memberships` |
| `players` (aktiv only) | **Ja** (alle Team-Mitglieder) | `players_select_active_only` |
| `memberships` | **Ja** (alle Mitglieder derselben `team_season`) | `memberships_select_team_season` |
| `profiles` | **Ja** (Team-Kollegen: gleiche `team_season`) | `profiles_select_team_peers` — Namen/Kontakt von Eltern/Spielern mit Membership sichtbar |
| `player_guardians` | **Nein** | Nur `player_guardians_select_own` (`user_id = auth.uid()`) |
| `player_users` | **Nein** | Nur `player_users_select_own` |
| `join_requests` | **Vermutlich ja** (App nutzt es) | Keine Migration im Repo; Staff liest in `JoinRequestsAdminPage` und `Header` |
| `auth.users.email` | **Nein** (direkt) | Nur über `find_user_id_by_email` (SECURITY DEFINER, Staff) |

### Fazit RLS für geplante Übersicht

Trainer können heute:

- Kader (`players`) und Team-Mitgliedschaften (`memberships`) lesen
- Profilnamen von Accounts mit Team-Membership lesen

Trainer können heute **nicht**:

- `player_guardians` / `player_users` abfragen → **keine Zuordnung Spieler ↔ Account** aus Client-Perspektive
- Zuverlässig erkennen, welcher Parent-Account zu welchem `player_id` gehört

**Für Phase 1 nötig:** neue RLS-Policy oder `SECURITY DEFINER`-RPC (z. B. `get_team_player_links(team_season_id)`), die nur Staff des Teams bedient und nur aggregierte/teambezogene Felder zurückgibt.

---

## Datenschutzbewertung

### Trainer dürfen sinnvoll sehen

- Spielername, Trikotnummer, Status (`active`/`paused`)
- Anzahl verknüpfter Eltern-Accounts pro Spieler
- Anzeigename des Eltern-Accounts (`profiles.first_name` / `last_name`)
- Ob ein Spieler-App-Account existiert und dessen Anzeigename
- Ob `join_requests` noch `pending` ist (Onboarding unvollständig)
- Optional `player_guardians.verified_at` (Verifizierungsstatus)

### Nicht anzeigen

- Technische IDs (`user_id`, `player_id`, UUIDs) in der UI
- `auth.users`-Login-E-Mail im Klartext (DSGVO/Need-to-know)
- Invite-/Zugangscodes (existieren aktuell nicht; falls später: nie dauerhaft im Klartext)
- Passwörter, Tokens, interne RPC-Details

### E-Mail

- `profiles.email` ist ein **öffentliches Kontaktfeld** (für Trainer-Staff gedacht). Für verknüpfte Eltern/Spieler: nur anzeigen, wenn bewusst als Team-Kontakt gepflegt — nicht automatisch Login-E-Mail aus `auth.users` exposen.
- Empfehlung: in Phase 1 **keine E-Mail** in der Verknüpfungsübersicht; nur Vor-/Nachname. E-Mail optional in Phase 2 nach expliziter Produktentscheidung.

### Codes

- Aktuell kein Code-System — kein Risiko.
- Falls später Einladungscodes: einmalig generieren, nicht in Listen persistieren anzeigen.

---

## Umsetzungsvorschlag

### A) Benötigte Tabellen/Joins

Vorgeschlagene Read-only-Query-Struktur (pro `team_season_id`):

```sql
-- Konzept (noch nicht implementiert)
SELECT
  p.id,
  p.first_name,
  p.last_name,
  p.jersey_number,
  p.status,
  -- Eltern
  COUNT(DISTINCT pg.user_id) AS guardian_count,
  -- Spieler-App
  EXISTS (SELECT 1 FROM player_users pu WHERE pu.player_id = p.id) AS has_player_account
FROM players p
LEFT JOIN player_guardians pg ON pg.player_id = p.id
WHERE p.team_season_id = :team_season_id
GROUP BY p.id
```

Zusätzliche Joins für Anzeigenamen:

- `player_guardians` → `profiles` (Elternnamen)
- `player_users` → `profiles` (Spieler-Account-Name)
- Optional: `join_requests` (pending-Status pro Team, nicht 1:1 zu `player_id` bei Spieler-Flow)

**Wichtig:** Query nur über Staff-RLS oder RPC ausführbar machen.

### B) Datenschutzprüfung

- Read-only Ansicht, keine Schreibaktionen in Phase 1
- Scope: nur aktive `team_season` des Trainers
- UI: keine UUIDs, keine Codes, keine Login-E-Mails
- Nur Vor-/Nachname + Zähler (z. B. „2 Elternaccounts“)
- Zugriff: `trainer`, `co_trainer`, `head_coach`, `admin`

### C) Beste UI-Position

**Empfehlung: Mehr → Teamverwaltung → Verknüpfungen**

Begründung:

- Passt zum Verwaltungs-Kontext (neben bestehender Saisonverwaltung in `MoreHubPage`)
- Trennt operative Kaderpflege (`TeamPage` / Tab „Kader“) von Account-/Onboarding-Status
- Nähe zu bestehendem Freigabe-Flow (`/admin/join-requests` / Rollenanfragen im Header)
- Trainer denken in „Team verwalten“, nicht in „Spielerprofil bearbeiten“

**Alternative: TeamPage → Tab „Verknüpfungen“**

- Pro: Kader-Kontext direkt neben Spielerliste
- Contra: `TeamPage` ist bereits umfangreich (Kader, Trainer, Training, Spiele); Verknüpfungen ist ein Querschnittsthema zu Accounts/Onboarding

### D) Mockup (Text)

```
┌─────────────────────────────────────────────────────────┐
│  Verknüpfungen – U11 2025/26                            │
├─────────────────────────────────────────────────────────┤
│  18 Spieler                                             │
│  14 mit Elternaccount    6 mit Spieler-App              │
│  4 ohne Eltern-Verknüpfung    12 ohne Spieler-App       │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│  Max Mustermann  #10  ● Aktiv                           │
│  Eltern:     ✅ Anna Mustermann (+ 1 weiterer Account)  │
│  Spieler-App: ✅ Max Mustermann                         │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│  Paul Beispiel  #7  ● Aktiv                             │
│  Eltern:     ⚠️ Noch kein Elternaccount                 │
│  Spieler-App: ⚠️ Noch kein Spieleraccount               │
│  Hinweis: Eltern können sich registrieren und Kind      │
│           unter „Kind verknüpfen“ auswählen.            │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│  Lukas Test  #3  ○ Pausiert                             │
│  Eltern:     ✅ Maria Test                               │
│  Spieler-App: — (nicht verknüpft)                       │
└─────────────────────────────────────────────────────────┘
```

### E) Aufwandsschätzung

| Bereich | Aufwand (grob) |
|---------|----------------|
| RLS / RPC für Staff-Lesezugriff | 0,5–1 Tag |
| Query / Service (`usePlayerLinks` o. ä.) | 0,5–1 Tag |
| UI-Seite + Navigation (Mehr → Teamverwaltung) | 1–1,5 Tage |
| Tests (RLS + UI Smoke) | 0,5 Tag |
| **Gesamt** | **~2,5–4 Tage** |

Zusatzaufwand falls `player_users`-Insert im Spieler-Onboarding nachgerüstet wird: +0,5 Tag.

---

## Empfehlung

**Phase 1: Nur Read-only Übersicht**

1. RLS-Erweiterung oder RPC für Staff-Lesezugriff auf `player_guardians` + `player_users` (team-scoped)
2. Neue Seite unter Mehr → Teamverwaltung → Verknüpfungen
3. Keine Trainer-Bestätigung in dieser Phase (bestehende `join_requests`-Freigabe bleibt separat)
4. Parallel klären/nachrüsten: `player_users`-Anlage im Spieler-Onboarding-Flow (aktuell Lücke)

**Später optional (Phase 2+):**

- Einladung erneut senden / Onboarding-Hinweis
- Spielercode-System (falls gewünscht)
- Onboarding-Center mit Status-Dashboard
- `player_guardians.verified_at` durch Trainer setzbar

**Nicht in Phase 1:** Schreibzugriffe, Code-Generierung, E-Mail-Exposé, Bestätigungs-Workflows.

---

## Anhang: Relevante Dateien

| Kategorie | Pfad |
|-----------|------|
| Eltern-Onboarding | `src/pages/ParentOnboardingPage.tsx` |
| Spieler-Onboarding | `src/pages/PlayerOnboardingPage.tsx` |
| Rollenwahl | `src/pages/RoleChoicePage.tsx` |
| Freigabe Admin | `src/pages/JoinRequestsAdminPage.tsx` |
| Onboarding-Gate | `src/app/layout/InternalLayout.tsx` |
| Session/Rollen | `src/auth/useSession.tsx`, `src/lib/roles.ts`, `src/auth/rbac.tsx` |
| Kader | `src/pages/TeamPage.tsx`, `src/hooks/usePlayers.ts` |
| Navigation | `src/pages/MoreHubPage.tsx` |
| RLS Migrationen | `supabase/migrations/20260308100000_rsvp_permissions_player_users.sql`, `20260308120001_profiles_names_and_guardian_verification.sql`, `20260528135200_players_status_and_rls.sql`, `20260605120000_team_staff_visibility.sql` |

*Erstellt: Juni 2026 — reine Analyse, keine Implementierung.*

---

## Umgesetzte Phase 1: Eltern-Verknüpfungen

**Stand:** Juni 2026 — Read-only Übersicht für Trainer-Staff im Team-Bereich.

### Datenquelle / RPC

Statt direkter RLS auf `player_guardians` (bisher nur `select_own`) wurde eine **SECURITY DEFINER RPC** ergänzt:

- **Funktion:** `get_team_player_parent_links(p_team_season_id uuid)`
- **Migration:** `supabase/migrations/20260619120000_get_team_player_parent_links.sql`
- **Berechtigung:** `can_manage_team_staff(p_team_season_id)` → `trainer`, `co_trainer`, `head_coach`, `admin` (+ System-Admin)
- **Joins:** `players` ← `player_guardians` → `profiles` (nur Kontaktfelder)
- **Rückgabe pro Spieler:** `player_id`, `player_name`, `jersey_number`, `status`, `is_active`, `parent_count`, `parents` (JSON-Array mit `user_id`, `name`, `email`)

**Warum RPC statt RLS:** `player_guardians` hat keine Staff-Select-Policy; eine breite RLS-Policy würde allen Team-Mitgliedern Zugriff geben. Die RPC liefert nur aggregierte Team-Daten an Staff und vermeidet `auth.users`-Zugriffe.

### UI-Position

- **Route:** `/app/team` (bestehende Spielerverwaltung)
- **Tab:** „Eltern“ (zwischen „Kader“ und „Trainer“)
- **Sichtbar für:** Staff (`canViewParentLinks` → `canManageMatches`)
- **Komponenten:** `src/components/team/TeamParentsTab.tsx`, Hook `src/hooks/useTeamPlayerParentLinks.ts`

### Funktionen

- Summary: Spieler gesamt / verknüpft / offen
- Filter: Alle / Verknüpft / Offen
- Spielerkarten mit Elternliste (Name + optional `profiles.email`)
- WhatsApp-Erinnerungstext kopieren bei offenen Spielern (Clipboard, kein API-Call)
- Loading-, Fehler- und Leerzustände

### Datenschutzentscheidung

- Nur Spieler der eigenen `team_season_id`
- Nur verknüpfte Eltern aus `player_guardians`
- E-Mail nur aus `profiles.email` (Kontaktfeld), kein `auth.users`
- Keine UUIDs in der UI
- Keine Codes

### Bewusst nicht umgesetzt

- Spieler-App-Verknüpfungen (`player_users`)
- Spielercodes / Invite-System
- Neues Onboarding
- Schreibzugriffe / Verifizierung (`verified_at`)
- Position unter Mehr → Teamverwaltung (bewusst im Kader-Tab belassen)
