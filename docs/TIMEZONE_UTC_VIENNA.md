# Zeitzonen: UTC in der DB, Anzeige Europe/Vienna

## Speicherung (UTC)

Diese Felder sind in Supabase/Postgres als **`timestamptz`** gedacht und werden in der App als **UTC-ISO-Strings** (z. B. `2025-07-15T20:35:00.000Z`) gelesen und geschrieben:

| Bereich | Felder |
|--------|--------|
| **events** | `starts_at`, `meetup_at`, `meeting_at`, `kickoff_at` (falls gesetzt), `created_at`, `updated_at` |
| **notification_jobs** | `send_at`, `sent_at`, `updated_at` |
| **messages** u. a. | `created_at` (wie bisher) |

Es gibt **keine** Umstellung der DB-Spalten auf „nur Vienna“ – Speicherstandard bleibt UTC.

## Eingabe (Trainer wählt lokale Wien-Zeit)

- `datetime-local` und Treffpunkt-`HH:mm` werden semantisch als **Uhrzeit in Europe/Vienna** interpretiert, unabhängig von der Browser-Zeitzone des Geräts.
- Konvertierung beim Speichern:
  - `parseViennaDateTimeLocalToUtcIso` – Beginn
  - `meetupUtcIsoOnViennaEventDay` – Treffpunkt am gleichen **Wiener Kalendertag** wie der Beginn
- Wiederholungen: `enumerateOccurrenceStarts` schrittet **Kalendertage in Vienna** (`addViennaCalendarDaysToUtcIso`); „Bis“-Datum: `viennaDateOnlyEndOfDayUtcIso` (Ende des Wiener Tages in UTC).

## Anzeige

Überall, wo Terminzeiten für Nutzer sichtbar sind, wird wo möglich **`Intl` mit `timeZone: Europe/Vienna`** verwendet (oder Hilfsfunktionen darunter).

### Neue / angepasste Helper (`src/lib/viennaTime.ts`)

- `parseViennaDateTimeLocalToUtcIso` – Formular → UTC-ISO  
- `utcIsoToViennaDateTimeLocal` – DB → `datetime-local`  
- `utcIsoToViennaTimeHHmm` – DB → Treffpunkt-Feld  
- `meetupUtcIsoOnViennaEventDay` – Treffpunkt speichern  
- `viennaDateOnlyEndOfDayUtcIso` – „Wiederholen bis“ (Datum)  
- `addViennaCalendarDaysToUtcIso` – wöchentlich / 14-tägig  
- `toViennaDayKeyFromUtcIso` / `toViennaDayKeyFromDate` – Kalender-Gruppierung  
- `zonedWallTimeToUtcMillis` – generische Wandzeit → UTC (exportiert für interne Nutzung)

### Format-Helfer (`src/lib/notifications/format.ts`)

- `formatEventDateVienna`, `formatEventTimeVienna`, `formatEventDateLongVienna`  
- `formatDateTimeDeVienna`, `formatDateTimeMediumDeVienna`  
- `buildReminderInAppBody` – Datum/Zeit/Treffpunkt mit `Europe/Vienna`

### Kalender (`src/pages/calendar/calendarUtils.ts`)

- `toViennaDayKey` (ersetzt die frühere reine Browser-`toLocalDayKey`-Semantik für Termine)  
- `formatTime`, `resolveEndAtFromNotes` – Vienna

### Weitere Stellen mit Vienna-Formatierung

- `CreateEventModal`, `SchedulePage` (Formular + Bearbeiten)  
- `MatchCardLigaportal` (app + MatchDetail), `CalendarPage` / ListView, `ics.ts` (Treffpunkt-Text)  
- `AppHomePage`, `MessagesPage`, `MessageDetailPage`, `NotificationsPage`, `TablePage`

## Reminder-Pipeline

- `buildReminderJobsForEvent` rechnet mit UTC-Instants aus der DB; `send_at` ist UTC.  
- Push-Texte in `api/send-reminders` / Edge Function formatieren Anzeige-Uhrzeiten bereits mit **Europe/Vienna**.

## Hinweis zu bestehenden Daten

Bereits gespeicherte Zeilen, die früher **fälschlich** als UTC interpretiert wurden (obwohl der Trainer „Wiener“ Uhrzeit meinte), bleiben in der DB unverändert. Neue und bearbeitete Termine folgen der korrekten Vienna→UTC-Logik. Bei Bedarf können alte Einträge einmalig manuell korrigiert werden.
