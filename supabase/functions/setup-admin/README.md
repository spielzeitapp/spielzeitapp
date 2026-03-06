# Edge Function: setup-admin

Vergibt Admin-Rechte für eine TeamSeason, wenn der Aufrufer eingeloggt ist und den gültigen Setup-Code mitsendet.

## Request-Body

```json
{ "code": "string", "teamSeasonId": "string" }
```

- **code**: Setup-Code (wird gegen Secret `ADMIN_SETUP_CODE` geprüft).
- **teamSeasonId**: ID der TeamSeason (string).

Aufruf (Frontend): `supabase.functions.invoke('setup-admin', { body: { code, teamSeasonId } })`.  
Der Supabase-Client sendet automatisch den Auth-Header (JWT).

## Ablauf

1. Setup-Code gegen Secret `ADMIN_SETUP_CODE` prüfen.
2. Caller muss eingeloggt sein (Authorization Bearer Token).
3. Bei gültigem Code:
   - Upsert in `public.user_roles`: `{ user_id, role: "admin" }` (onConflict: user_id).
   - Upsert in `public.memberships`: `{ user_id, team_season_id, role: "admin" }` (onConflict: user_id, team_season_id).
4. Response: `{ success: true }`. Bei Fehler (z. B. memberships upsert): JSON mit `error`.

## Deploy (Supabase CLI)

```bash
supabase functions deploy setup-admin
```

## Function ENV / Secrets

- **ADMIN_SETUP_CODE** – Geheimer Setup-Code.
- **SUPABASE_SERVICE_ROLE_KEY** – i. d. R. von Supabase gesetzt.
- **SUPABASE_ANON_KEY** – für JWT-Verifikation.

Voraussetzung: Tabelle `user_roles` mit mindestens `(user_id, role)` und UNIQUE auf `user_id` (oder passend für Upsert). Tabelle `memberships` mit UNIQUE `(user_id, team_season_id)`.
