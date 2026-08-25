# KI-Kurzfassung für Trainingsübungen

Die Edge Function erstellt ausschließlich bearbeitbare Kurzfassungen. Die ausführlichen
Originaltexte werden weder verändert noch gespeichert.

## Secrets

In Supabase unter **Edge Functions → Secrets** setzen:

- `OPENAI_API_KEY`
- optional `OPENAI_SHORTEN_MODEL` (Standard: `gpt-4.1-mini`)

## Deployment (Staging)

```bash
supabase functions deploy shorten-training-exercise --project-ref acbaecjzoabafbsjrzvr
```

Der Aufruf ist nur für angemeldete Benutzer mit `can_manage_club_venues(club_id)` erlaubt.
