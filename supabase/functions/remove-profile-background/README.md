# remove-profile-background

Supabase Edge Function: Profilfoto → freigestelltes PNG via externe Background-Removal-API.

## Request (POST, JSON)

```json
{
  "entityType": "player",
  "entityId": "uuid",
  "teamSeasonId": "uuid",
  "sourceImageUrl": "https://..."
}
```

`entityType`: `"player"` | `"staff"`

## Response

Erfolg:

```json
{ "cutoutUrl": "https://..." }
```

Fallback (Upload im Client bleibt gültig):

```json
{ "cutoutUrl": null, "warning": "..." }
```

## Secrets (Supabase Dashboard → Edge Functions → Secrets)

| Secret | Beispiel |
|--------|----------|
| `BACKGROUND_REMOVAL_API_KEY` | remove.bg API Key |
| `BACKGROUND_REMOVAL_API_URL` | `https://api.remove.bg/v1.0/removebg` |

Automatisch von Supabase bereitgestellt: `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`

## Deploy

```bash
supabase functions deploy remove-profile-background
supabase secrets set BACKGROUND_REMOVAL_API_KEY=... BACKGROUND_REMOVAL_API_URL=https://api.remove.bg/v1.0/removebg
```

## Storage

| entityType | Bucket | Pfad |
|------------|--------|------|
| player | `player-avatars` | `{teamSeasonId}/cutouts/player-{entityId}.png` |
| staff | `team-photos` | `{teamSeasonId}/cutouts/staff-{entityId}.png` |

Upload erfolgt mit Service Role nach Auth-Check (`can_manage_team_staff`).
