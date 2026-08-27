# KI-Kurzfassung für Trainingsübungen

Die Edge Function erstellt ausschließlich bearbeitbare Kurzfassungen. Die ausführlichen
Originaltexte werden weder verändert noch gespeichert.

Die Prüfung ist übungsunabhängig:

1. Aus Organisation, Ablauf und Variationen wird eine dynamische Liste unverzichtbarer Fakten extrahiert.
2. Die Kurzfassung wird unter Einhaltung dieser Fakten und des verfügbaren Zeichenbudgets erstellt.
3. Eine separate KI-Prüfung vergleicht die Kurzfassung direkt mit dem vollständigen Original und nutzt die Faktenliste nur als zusätzliche Prüfhilfe.
4. Jede vorhandene Variation wird separat gekürzt und anschließend inhaltlich sowie in ihrer ursprünglichen Reihenfolge gegen das Original geprüft. Neue Variationen werden nicht erzeugt.

Die zulässigen Längen für Ablauf und Variationen werden für jede Übung aus dem gemeinsamen
760-Zeichen-Budget berechnet und direkt im strukturierten KI-Ausgabeformat erzwungen.

Dadurch funktionieren Pass-, Technik-, Torschuss-, Koordinations- und Spielformen ohne fest
programmierte Regeln für einzelne Übungen.

## Secrets

In Supabase unter **Edge Functions → Secrets** setzen:

- `OPENAI_API_KEY`
- optional `OPENAI_SHORTEN_MODEL` (Standard: `gpt-4.1`)

## Deployment (Staging)

```bash
supabase functions deploy shorten-training-exercise --project-ref acbaecjzoabafbsjrzvr
```

Der Aufruf ist nur für angemeldete Benutzer mit `can_manage_club_venues(club_id)` erlaubt.
