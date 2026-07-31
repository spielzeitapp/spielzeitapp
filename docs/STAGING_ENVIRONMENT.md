# Staging- / Testumgebung SpielzeitApp

Feste Trennung von Production und Staging. Keine Preview-URLs als Dauerlösung.

## Branch-Struktur

| Branch | Zweck |
|--------|--------|
| `main` | Production — nur freigegebene Änderungen |
| `develop` | Staging / Dauer-Tests unter fixer Domain |
| `cursor/*` / Feature-Branches | Entwicklung → nach Build nach `develop` |

**Workflow**

1. Feature-Branch anlegen  
2. `npm run typecheck` + `npm run build`  
3. Commit + Push Feature-Branch  
4. Merge/Push nach `develop`  
5. Test unter fixer Staging-Domain  
6. Freigabe → Merge nach `main` → Production-Deploy  

`main` nicht mit ungetesteten Features befüllen.

## Vercel-Projekte

| Projekt | Domain | Git-Branch (Soll) | Supabase |
|---------|--------|-------------------|----------|
| `spielzeitapp-intern` / Production | `app.spielzeitapp.at` | `main` | Live `shxugattqatahckhspwk` (spielzeitapp-nsg) |
| `spielzeitapp-staging` | `test.spielzeitapp.at` (oder `staging.…`) | `develop` | Staging `acbaecjzoabafbsjrzvr` |
| `spielzeitapp` (Marketing) | `spielzeitapp.at` | nach Bedarf | — |

**Bevorzugt:** eigenes Projekt `spielzeitapp-staging` (existiert bereits: `prj_B0euEsAU4bghYDkZnHmQz6y5JhcB`).

### Manuell in Vercel (Staging-Projekt)

1. Project **spielzeitapp-staging** → Settings → Git  
   - Repository: `spielzeitapp/spielzeitapp`  
   - Production Branch: **`develop`** (nicht `main`)  
2. Settings → Domains  
   - Domain hinzufügen: **`test.spielzeitapp.at`** (bevorzugt) oder `staging.spielzeitapp.at`  
3. DNS beim Domain-Provider (spielzeitapp.at):  
   - CNAME `test` → `cname.vercel-dns.com` (oder den von Vercel angezeigten Target)  
4. Settings → Environment Variables → **nur Production** dieses Staging-Projekts (siehe unten)  
5. Im **Production-Projekt** (`spielzeitapp-intern` / App):  
   - `VITE_SUPABASE_URL` / Anon-Key **nicht** für Preview auf Live teilen, wenn Previews weiter existieren  
   - Empfohlen: Preview-Deployments deaktivieren **oder** Preview-Envs explizit auf Staging-Supabase setzen  
   - **Niemals** Preview/Staging auf `shxugattqatahckhspwk` (Live) lassen  

### Manuell: Environment Variables Staging (`spielzeitapp-staging`)

Werte aus Supabase Dashboard → Project **spielzeitapp-staging** (`acbaecjzoabafbsjrzvr`) → Settings → API.

| Variable | Wert |
|----------|------|
| `VITE_APP_ENV` | `staging` |
| `APP_ENV` | `staging` |
| `STAGING_DISABLE_OUTBOUND` | `true` |
| `VITE_APP_BASE_URL` | `https://test.spielzeitapp.at` |
| `APP_BASE_URL` | `https://test.spielzeitapp.at` |
| `VITE_SUPABASE_URL` | `https://acbaecjzoabafbsjrzvr.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | Staging anon/publishable key |
| `SUPABASE_URL` | gleich Staging-URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Staging service_role (nur Server) |
| `VITE_VAPID_PUBLIC_KEY` / `VAPID_*` | eigene Staging-Keys **oder** leer lassen (Push ohnehin blockiert) |
| `CRON_SECRET` | Staging-Wert oder Cron in Staging-Projekt entfernen |

Production-Variablen auf Live-Projekt **unverändert** lassen (`VITE_APP_ENV=production` oder unset + Live-URL).

### Manuell: Environment Variables Production (App)

| Variable | Wert |
|----------|------|
| `VITE_APP_ENV` | `production` (optional, Default bei Prod-Build) |
| `VITE_SUPABASE_URL` | `https://shxugattqatahckhspwk.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | Live anon key |
| `VITE_APP_BASE_URL` | `https://app.spielzeitapp.at` |
| `APP_BASE_URL` | `https://app.spielzeitapp.at` |
| Server-Keys | Live service_role, Live VAPID, Cron nur hier |

## Auth-Redirects

Client nutzt `window.location.origin` ([`src/lib/authRedirect.ts`](../src/lib/authRedirect.ts)) — Staging bleibt auf der Test-Domain, solange man dort eingeloggt ist.

### Manuell: Supabase Auth (Staging-Projekt)

Dashboard → **spielzeitapp-staging** → Authentication → URL Configuration:

- **Site URL:** `https://test.spielzeitapp.at`  
- **Redirect URLs** (zusätzlich):  
  - `https://test.spielzeitapp.at/**`  
  - `https://staging.spielzeitapp.at/**` (falls genutzt)  
  - `http://localhost:5173/**` (lokal)

### Manuell: Supabase Auth (Live) — unverändert

- Site URL: `https://app.spielzeitapp.at`  
- Redirects für Production beibehalten  

Keine Staging-Domain als Production-Site-URL eintragen.

## Sichtbare Kennzeichnung

Bei `VITE_APP_ENV=staging` erscheint im Header ein kleines **TEST**-Badge ([`Header.tsx`](../src/app/layout/Header.tsx)).

## Sicherheits-Guards (Code)

- Staging-Build wirft, wenn `VITE_SUPABASE_URL` auf Live (`shxugattqatahckhspwk`) zeigt.  
- `/api/send-reminders`, `/api/push/send-team`, Notification-Dispatch: bei `APP_ENV`/`VITE_APP_ENV=staging` oder `STAGING_DISABLE_OUTBOUND=true` → kein Outbound-Push.  
- Cronjobs im Staging-Vercel-Projekt entfernen oder Secret weglassen.

## Migrationen

| Regel | |
|-------|--|
| Zuerst | immer auf **spielzeitapp-staging** anwenden |
| Danach | nach Test freigeben → separat auf Live (`spielzeitapp-nsg`) |
| Nie | automatisch Live ohne Freigabe |

### Stand (Dokumentation, Stand 2026-07-31)

| Migration / Change | Staging `acbaecjzoabafbsjrzvr` | Live `shxugattqatahckhspwk` |
|--------------------|-------------------------------|-----------------------------|
| Lifecycle `team_seasons` (20260612…) | prüfen im Staging-SQL-Editor | vorhanden (App nutzt Spalten) |
| Draft-Insert-RLS `20260731140000_team_seasons_draft_insert_rls.sql` | laut Team auf Staging ausgeführt | **auch auf Live/nsg angewendet** (Fix Preview→nsg, 2026-07-31) |

Weitere Migrationen: Dateien unter `supabase/migrations/` — vor Live-Apply Diff im SQL-Editor gegen `pg_policies` / Funktionen prüfen.

Apply-Beispiel (CLI, linked = aktuell Live):

```bash
# Staging: Projekt kurz linken oder SQL im Staging-Dashboard paste
npx supabase link --project-ref acbaecjzoabafbsjrzvr
npx supabase db query --linked -f supabase/migrations/<file>.sql
```

## Checkliste nach Setup

- [ ] `develop` deployed auf `spielzeitapp-staging`  
- [ ] `test.spielzeitapp.at` erreichbar, Header zeigt **TEST**  
- [ ] Network-Tab: Requests nur an `acbaecjzoabafbsjrzvr.supabase.co`  
- [ ] Login bleibt auf Test-Domain  
- [ ] Reminder/Push in Staging liefern `skipped` / keine Live-Nutzer  
- [ ] `app.spielzeitapp.at` unverändert auf Live-Supabase  
