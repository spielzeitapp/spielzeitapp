# Profil-Cutout Roadmap

Ziel: Der Benutzer lädt **ein** Profilfoto hoch. Die App verwaltet intern:

- `avatar_url` — rundes/listen-taugliches Foto
- `cutout_url` — freigestellte PNG/WebP für den Profil-Hero

Keine KI-Freistellung in Phase 1. Transparente Uploads werden bereits als Cutout erkannt (`profileCutoutUpload.ts`).

---

## Bestehende Upload-Flows (Analyse)

### 1. Spielerfoto

| Aspekt | Details |
|--------|---------|
| **UI** | `PlayerSquadFormModal.tsx` — Datei-Picker „Foto hochladen“ |
| **Orchestrierung** | `TeamPage.tsx` → `handleSquadFormSubmit` |
| **Upload-Helper** | `profileCutoutUpload.ts` → `uploadPlayerProfilePhoto()` |
| **Storage-Bucket** | `player-avatars` (public) |
| **Pfade** | Avatar: `{teamSeasonId}/{playerId}.{ext}` |
| | Cutout (optional): `{teamSeasonId}/cutouts/{playerId}.png` |
| **Tabellen** | `player_avatars.avatar_url` (Upsert) |
| | `players.cutout_url` (Update, wenn transparentes PNG/WebP) |
| **RPCs** | keine (direkte Supabase Client Calls) |
| **RLS** | `player_avatar_storage_may_manage()` — Migration `20260608120000` |

### 2. Trainerfoto

| Aspekt | Details |
|--------|---------|
| **UI** | `TrainerStaffFormModal.tsx` |
| **Orchestrierung** | `useTrainerStaffEditor.ts` → `handleTrainerFormSubmit` |
| **Upload-Helper** | `profileCutoutUpload.ts` → `uploadStaffProfilePhoto()` |
| **Storage-Bucket** | `team-photos` (public) |
| **Pfade** | Avatar: `{teamSeasonId}/staff/{userId}.{ext}` |
| | Cutout (optional): `{teamSeasonId}/cutouts/{userId}.png` |
| **Tabellen** | `profiles.avatar_url`, `profiles.cutout_url` |
| **RPCs** | `upsert_team_staff_member(..., p_avatar_url, p_cutout_url)` |
| | `list_team_staff_for_season` (liest `cutout_url`) |
| **RLS** | `staff_photo_storage_may_access_path()` — staff + cutouts |

### 3. Mannschaftsfoto (Team-Hero)

| Aspekt | Details |
|--------|---------|
| **UI** | `TeamPage.tsx` — Team-Tab Hero / Kamera-Button |
| **Orchestrierung** | `TeamPage.tsx` → `handleTeamPhotoPick` |
| **Storage-Bucket** | `team-photos` |
| **Pfad** | `{teamSeasonId}/hero.{ext}` |
| **Tabellen** | `team_photos.photo_url` |
| **RPCs** | keine |
| **Hinweis** | Kein Profil-Cutout — separates Team-Banner, nicht Spieler/Trainer |

### Hero-Hintergrund (statisch)

| Aspekt | Details |
|--------|---------|
| **Asset** | `public/profile/profile-hero-stadium.PNG` |
| **Erkennung** | `profileHeroStadiumBg.ts` |
| **UI** | `ProfileHeroCard.tsx` |

### Code-Module (Profilbilder)

| Modul | Rolle |
|-------|--------|
| `profileCutoutUpload.ts` | Storage-Upload + Alpha-Erkennung |
| `profileHeroImage.ts` | Cutout vs. Avatar Layout |
| `profileImagePipeline.ts` | Gemeinsame API für Phase 2/3 |
| `staffAvatar.ts` | Legacy-Wrapper Trainer-Upload |

---

## Phasen

### Phase 1 — Avatar Upload (aktuell)

- Ein Datei-Upload pro Spieler/Trainer
- Avatar in Storage + DB
- Transparente PNG/WebP → zusätzlich `cutout_url` (Copy unter `/cutouts/`)
- Hero: `cutout_url` → Cutout-Modus, sonst Avatar-Rahmen
- Pipeline-Einstieg: `uploadProfileAvatar()` in `profileImagePipeline.ts`

### Phase 2 — Background Removal (MVP, implementiert)

- Nach Avatar-Upload: `prepareCutoutGeneration()` → Edge Function `remove-profile-background`
- Original aus `sourceImageUrl` laden, Hintergrund via externe API entfernen
- PNG mit Alpha unter `{teamSeasonId}/cutouts/{entityType}-{entityId}.png` speichern
- Caller: `resolveCutoutAfterAvatarUpload()` in `TeamPage` (Spieler) und `useTrainerStaffEditor` (Trainer)

Markierung im Code:

```ts
// STEP 2: background removal
```

### Phase 3 — Auto-Cutout Hero (MVP, implementiert)

- `cutout_url` automatisch in DB setzen nach erfolgreicher Freistellung
- Spieler: `players.cutout_url`
- Trainer: `upsert_team_staff_member` mit `p_cutout_url`
- Hero nutzt Cutout ohne manuelles PNG vom User
- Fallback: Avatar-Modus bleibt für JPG / fehlgeschlagene Freistellung

Markierung im Code:

```ts
// STEP 3: generate cutout_url
```

---

## Environment & Deploy

### Supabase Secrets (Edge Function)

| Variable | Beschreibung | Beispiel |
|----------|--------------|----------|
| `BACKGROUND_REMOVAL_API_KEY` | API-Key der Freistellungs-API | *(remove.bg API Key)* |
| `BACKGROUND_REMOVAL_API_URL` | Endpoint der Freistellungs-API | `https://api.remove.bg/v1.0/removebg` |

Secrets setzen (Projekt verlinkt):

```bash
supabase secrets set \
  BACKGROUND_REMOVAL_API_KEY=your_key_here \
  BACKGROUND_REMOVAL_API_URL=https://api.remove.bg/v1.0/removebg
```

Der API-Key liegt **nur** in Supabase Secrets — nicht im Frontend, nicht in `.env` der Vite-App.

### Edge Function deployen

```bash
supabase functions deploy remove-profile-background
```

Funktion: `supabase/functions/remove-profile-background/index.ts`

Request-Body:

```json
{
  "entityType": "player" | "staff",
  "entityId": "<uuid>",
  "teamSeasonId": "<uuid>",
  "sourceImageUrl": "<public avatar URL>"
}
```

Response bei Erfolg:

```json
{ "cutoutUrl": "https://..." }
```

Response bei überspringbarem Fehler (Upload bleibt gültig):

```json
{ "cutoutUrl": null, "warning": "..." }
```

### Storage-Pfade (API-Cutout)

| Entity | Bucket | Pfad |
|--------|--------|------|
| Spieler | `player-avatars` | `{teamSeasonId}/cutouts/player-{playerId}.png` |
| Trainer | `team-photos` | `{teamSeasonId}/cutouts/staff-{userId}.png` |

RLS: Migration `20260608130000_profile_cutout_entity_prefix_rls.sql`

---

## Verhalten bei API-Fehler

| Situation | Verhalten |
|-----------|-----------|
| `BACKGROUND_REMOVAL_API_KEY` / `BACKGROUND_REMOVAL_API_URL` fehlt | Edge Function gibt `{ cutoutUrl: null, warning: "…not configured" }` — Avatar-Upload bleibt erfolgreich |
| Externe API antwortet mit Fehler | `console.warn` im Frontend, kein Crash, Hero nutzt `avatar_url` |
| Edge Function nicht deployed | `supabase.functions.invoke` schlägt fehl → `prepareCutoutGeneration` → `status: "failed"`, Upload unverändert |
| User lädt transparentes PNG hoch | Client erkennt Alpha → `existingCutoutUrl` gesetzt → API wird **nicht** aufgerufen |
| Netzwerk-Timeout / Exception | Abgefangen in `prepareCutoutGeneration`, `warning` geloggt |

Keine harte Blockade: Der Squad-/Trainer-Speichern-Flow bricht wegen Cutout-Fehlern nicht ab.

---

## Optionale spätere Erweiterungen

- `profile_cutout_jobs` Tabelle (status, entity_type, entity_id, error) für asynchrone Verarbeitung
- Retry-Queue bei API-Limits
- Sichtbarer UI-Hinweis „Freistellung fehlgeschlagen“ (optional, aktuell nur `console.warn`)

---

## Tests (manuell)

1. Spieler JPG hochladen → `avatar_url` gesetzt; mit konfigurierter API zusätzlich `cutout_url`, Hero Cutout-Modus
2. Spieler JPG ohne API-Key → nur `avatar_url`, Hero Avatar-Modus
3. Spieler transparentes PNG → `avatar_url` + `cutout_url` (Client), API wird übersprungen
4. Trainer analog zu 1–3
5. Team-Hero unverändert
