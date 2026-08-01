# Staging- / Live-Deployment SpielzeitApp

Zwei aktive Wege — keine Feature-Branch-Previews als Dauer-Testumgebung.

## Zielbild

| | LIVE | STAGING |
|--|------|---------|
| **Domain** | https://spielzeitapp.at | https://app.spielzeitapp.at |
| **Branch** | `main` | `develop` |
| **Supabase** | Live `shxugattqatahckhspwk` (spielzeitapp-nsg) | Staging `acbaecjzoabafbsjrzvr` |
| **Nutzer** | echte Nutzer | nur Tests |
| **Badge** | keines | **TEST** (`VITE_APP_ENV=staging`) |

Feature-Branches (`cursor/*`, …): push erlaubt, **kein** Vercel-Deploy → Merge nach `develop` → Test → Freigabe → `main`.

## Branch-Workflow

1. Feature-Branch  
2. `npm run typecheck` + `npm run build`  
3. Commit + Push Feature-Branch (kein Deploy)  
4. Merge nach `develop` → Staging-Deploy auf `app.spielzeitapp.at`  
5. Freigabe → Merge nach `main` → Live auf `spielzeitapp.at`  

`main` nicht mit ungetesteten Features befüllen.

## Vercel-Projekte (Inventar)

| Projekt | ID (kurz) | Aktuelle Prod-URL | Soll-Rolle |
|---------|-----------|-------------------|------------|
| **spielzeitapp** | `prj_bOBl…` | https://spielzeitapp.at | **LIVE** — Branch `main`, Live-Supabase |
| **spielzeitapp-intern** | `prj_DYYQ…` | https://app.spielzeitapp.at | **STAGING** — Branch `develop`, Staging-Supabase |
| spielzeitapp-staging | `prj_B0eu…` | *.vercel.app | **Altlast** — Git-Deploys deaktivieren |
| spielzeitapp_clean | `prj_oFNf…` | *.vercel.app | **Altlast** — Git-Deploys deaktivieren |

Nur Wege A + B aktiv halten. Altprojekte nicht löschen, aber keine neuen Deploys.

### Feature-Branch-Deploys stoppen (Repo)

[`vercel.json`](../vercel.json) → `ignoreCommand`: `node scripts/vercel-ignore-build.mjs`

Pro Projekt Env **`VERCEL_DEPLOY_BRANCH`**:

| Projekt | `VERCEL_DEPLOY_BRANCH` |
|---------|------------------------|
| LIVE (`spielzeitapp`) | `main` |
| STAGING (`spielzeitapp-intern`) | `develop` |

Ohne Treffer wird der Build übersprungen (exit 0).

---

## Manuelle Schritte Vercel (Pflicht)

### A) LIVE — Projekt `spielzeitapp`

1. Settings → Git → Production Branch = **`main`**  
2. Domains: **`spielzeitapp.at`** (und www falls genutzt) bleiben hier  
3. Environment Variables (Production):

| Variable | Wert |
|----------|------|
| `VERCEL_DEPLOY_BRANCH` | `main` |
| `VITE_APP_ENV` | `production` |
| `VITE_SUPABASE_URL` | `https://shxugattqatahckhspwk.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | Live anon key |
| `SUPABASE_URL` | Live-URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Live service_role |
| `VITE_APP_BASE_URL` / `APP_BASE_URL` | `https://spielzeitapp.at` |
| VAPID / Cron | Live-Werte |

4. Preview-Deployments: deaktivieren **oder** Preview-Envs nicht auf Live-Keys setzen  
5. Ignored Build Step: Repo-`ignoreCommand` nutzen; optional Dashboard-Override entfernen falls Konflikt  

### B) STAGING — Projekt `spielzeitapp-intern` (Domain app.spielzeitapp.at)

1. Settings → Git → Production Branch = **`develop`** (nicht main)  
2. Domains: **`app.spielzeitapp.at`** bleibt an diesem Projekt  
3. Environment Variables (Production dieses Projekts) **nur Staging**:

| Variable | Wert |
|----------|------|
| `VERCEL_DEPLOY_BRANCH` | `develop` |
| `VITE_APP_ENV` | `staging` |
| `APP_ENV` | `staging` |
| `STAGING_DISABLE_OUTBOUND` | `true` |
| `VITE_SUPABASE_URL` | `https://acbaecjzoabafbsjrzvr.supabase.co` |
| `VITE_SUPABASE_ANON_KEY` | Staging anon key |
| `SUPABASE_URL` | Staging-URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Staging service_role |
| `VITE_APP_BASE_URL` / `APP_BASE_URL` | `https://app.spielzeitapp.at` |
| VAPID / Cron | leer oder Staging-only; Cron idealerweise entfernen |

4. **Wichtig:** `app.spielzeitapp.at` darf **nicht** auf `shxugattqatahckhspwk` (Live/nsg) zeigen  

### C) Altlasten `spielzeitapp-staging` / `spielzeitapp_clean`

1. Settings → Git → **Disconnect** Repository **oder**  
2. Settings → Git → Deploy Hooks/Auto Deploy aus; Ignored Build Step: `exit 0` (immer skip)  
3. Domains: keine Production-Domains zuweisen  

---

## Manuelle Schritte Supabase Auth

### Staging (`acbaecjzoabafbsjrzvr`)

Authentication → URL Configuration:

- **Site URL:** `https://app.spielzeitapp.at`  
- **Redirect URLs:** `https://app.spielzeitapp.at/**` (+ lokal `http://localhost:5173/**` falls nötig)

### Live (`shxugattqatahckhspwk`)

- Site URL / Redirects für **`https://spielzeitapp.at`** unverändert lassen  
- Keine Staging-Domain als Live-Site-URL  

Client: [`src/lib/authRedirect.ts`](../src/lib/authRedirect.ts) nutzt `window.location.origin` — kein Hardcode Staging→Live.

---

## Staging-Sicherheit (Code)

- `STAGING_DISABLE_OUTBOUND` / `APP_ENV=staging` → Reminder, Team-Push, Notification-Dispatch = `skipped`  
- Staging-Build wirft, wenn `VITE_SUPABASE_URL` auf Live-Host zeigt  
- Header-Badge **TEST** nur bei `VITE_APP_ENV=staging`  

## Migrationen

Zuerst Staging, nach Freigabe separat Live. Nie automatisch Live ohne Freigabe.

| Change | Staging | Live |
|--------|---------|------|
| Draft-Insert-RLS `20260731140000_…` | anwenden/prüfen | auf nsg bereits angewendet (2026-07-31) |

---

## Abnahme-Checkliste

- [ ] Push `cursor/*` → kein Vercel-Deploy  
- [ ] Push/Merge `develop` → genau Staging-Deploy → `app.spielzeitapp.at`  
- [ ] `app.spielzeitapp.at`: TEST-Badge; Network nur `acbaecjzoabafbsjrzvr.supabase.co`  
- [ ] Login/Logout/Callback bleiben auf `app.spielzeitapp.at`  
- [ ] Push/Reminder Staging blockiert  
- [ ] `spielzeitapp.at` + `main` → Live-Supabase `shxugattqatahckhspwk`  
