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

### Phase 2 — Background Removal

- Nach Avatar-Upload: `prepareCutoutGeneration()` aufrufen
- Original aus Storage laden
- Hintergrund serverseitig entfernen (Edge Function / Worker — **noch offen**)
- PNG mit Alpha unter `{teamSeasonId}/cutouts/{entityId}.png` speichern

Markierung im Code:

```ts
// STEP 2: background removal
```

### Phase 3 — Auto-Cutout Hero

- `cutout_url` automatisch in DB setzen (Spieler + Trainer)
- Hero nutzt Cutout ohne manuelles PNG vom User
- Fallback: Avatar-Modus bleibt für JPG / fehlgeschlagene Freistellung

Markierung im Code:

```ts
// STEP 3: generate cutout_url
```

---

## Geplante Migration (Phase 2+)

- Optional: `profile_cutout_jobs` Tabelle (status, entity_type, entity_id, error)
- Optional: Supabase Edge Function `generate-profile-cutout`
- Keine Breaking Changes an bestehenden Pfaden

---

## Tests (manuell)

1. Spieler JPG hochladen → nur `avatar_url`, Hero Avatar-Modus
2. Spieler transparentes PNG → `avatar_url` + `cutout_url`, Hero Cutout-Modus
3. Trainer analog
4. Team-Hero unverändert
