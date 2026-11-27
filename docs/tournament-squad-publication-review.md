# Turnierkader veröffentlichen

Der Entwurf wird anhand der Event-ID gespeichert. Ein gemeinsamer Event-Lock serialisiert Entwurfsänderungen und Veröffentlichungen. Bei der Bestätigung prüft die Datenbank den erwarteten Kader sowie die veröffentlichte Version und schreibt Momentaufnahme, Feed-Beitrag, Inbox und Push-Aufträge in derselben Transaktion. Pro Turnier existiert ein Feed-Beitrag. Wiederholte Bestätigungen derselben Version erzeugen keine weiteren Aufträge.

## Prüfung

- Aktuelle LIVE-Spalten, RLS der betroffenen Bestandsfunktionen, Rollenprüfungen, Job-Arten und Deduplizierung lesend geprüft.
- Isolierte PostgreSQL-Probe mit Trainer, Elternkonto und anonymer Rolle. Enthalten sind ein Turnier ohne Spiele, ein unzulässiges Match-Event, Spieler außerhalb des Saisonkaders, ein leerer Kader, ungültige Texte, veralteter Entwurf und Version, idempotenter Retry, Mehrfachverknüpfung und ein aktualisierter Feed-Post.
- Im mobilen Demo-Browser wurde der Bestätigungsdialog geöffnet und abgebrochen. Erstveröffentlichung und erneutes Veröffentlichen nach einer Kaderänderung wurden durchgespielt.
- TEST-Migration: `tournament_squad_publication`. TEST legt Inbox-Einträge unmittelbar an. Der allgemeine Push-Worker ist in TEST derzeit nicht eingeplant.
- LIVE-Schema wurde für diese Entwicklung nur lesend geprüft. Die Migration ist nicht zur LIVE-Ausführung im Release-Plan eingetragen.
