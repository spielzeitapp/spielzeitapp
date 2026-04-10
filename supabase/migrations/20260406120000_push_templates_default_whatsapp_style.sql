-- Standard-Vorlagen für Team-Push (WhatsApp-Ersatz).
-- Pro team_id nur einmal je exaktem Titel (keine Duplikate).
-- Reihenfolge in der App: fetchTemplates sortiert nach created_at DESC → höheres Datum = weiter oben.

INSERT INTO public.push_templates (team_id, created_by, title, message, link, created_at)
SELECT
  x.team_id,
  NULL::uuid,
  d.title,
  d.message,
  d.link,
  now() + ((9 - d.sort_order) * interval '1 second')
FROM (
  SELECT DISTINCT ts.team_id AS team_id
  FROM public.team_seasons ts
  WHERE ts.team_id IS NOT NULL
) x
CROSS JOIN (
  VALUES
    (
      1,
      'Training heute',
      'Bitte denkt an das heutige Training und gebt Bescheid, falls jemand verhindert ist.'::text,
      '/app/termine'::text
    ),
    (
      2,
      'Spiel heute',
      'Bitte Treffpunkt, Uhrzeit und alle Infos in der App beachten. Gebt Zu- oder Absage rechtzeitig bekannt.'::text,
      '/app/termine'::text
    ),
    (
      3,
      'Treffpunkt geändert',
      'Achtung: Der Treffpunkt wurde aktualisiert. Bitte die neuen Informationen in der App prüfen.'::text,
      '/app/termine'::text
    ),
    (
      4,
      'Uhrzeit geändert',
      'Achtung: Die Uhrzeit wurde geändert. Bitte den aktualisierten Termin in der App beachten.'::text,
      '/app/termine'::text
    ),
    (
      5,
      'Spiel verschoben',
      'Das Spiel wurde verschoben. Bitte den neuen Termin und alle Infos in der App beachten.'::text,
      '/app/termine'::text
    ),
    (
      6,
      'Training abgesagt',
      'Das heutige Training findet nicht statt. Bitte die App für weitere Infos beachten.'::text,
      '/app/termine'::text
    ),
    (
      7,
      'Bitte Rückmeldung',
      'Bitte tragt eure Zu- oder Absage in der App ein, damit wir besser planen können.'::text,
      '/app/termine'::text
    ),
    (
      8,
      'Team-Info',
      'Bitte die neue Information in der App beachten.'::text,
      '/app/nachrichten'::text
    )
) AS d(sort_order, title, message, link)
WHERE NOT EXISTS (
  SELECT 1
  FROM public.push_templates p
  WHERE p.team_id = x.team_id
    AND p.title = d.title
);

SELECT pg_notify('pgrst', 'reload schema');
