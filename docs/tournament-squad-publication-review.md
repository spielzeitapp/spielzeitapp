# Turnierkader veröffentlichen

Der Entwurf wird anhand der Event-ID gespeichert. Ein gemeinsamer Event-Lock serialisiert Entwurfsänderungen und Veröffentlichungen. Bei der Bestätigung prüft die Datenbank den erwarteten Kader sowie die veröffentlichte Version und schreibt Momentaufnahme, Feed-Beitrag, Inbox und Push-Aufträge in derselben Transaktion. Pro Turnier existiert ein Feed-Beitrag. Wiederholte Bestätigungen derselben Version erzeugen keine weiteren Aufträge.

## Prüfung

- Aktuelle LIVE-Spalten, RLS der betroffenen Bestandsfunktionen, Rollenprüfungen, Job-Arten und Deduplizierung lesend geprüft.
- Isolierte PostgreSQL-Probe mit Trainer, Elternkonto und anonymer Rolle. Enthalten sind ein Turnier ohne Spiele, ein unzulässiges Match-Event, Spieler außerhalb des Saisonkaders, ein leerer Kader, ungültige Texte, veralteter Entwurf und Version, idempotenter Retry, Mehrfachverknüpfung und ein aktualisierter Feed-Post.
- Im mobilen Demo-Browser wurde der Bestätigungsdialog geöffnet und abgebrochen. Erstveröffentlichung und erneutes Veröffentlichen nach einer Kaderänderung wurden durchgespielt.
- TEST-Migration: `tournament_squad_publication`. TEST legt Inbox-Einträge unmittelbar an. Der allgemeine Push-Worker ist in TEST derzeit nicht eingeplant.
- Für die separate LIVE-Freigabe wurden Tabellenrechte, Kader-RLS, Staff-Prüfung, Inbox-Deduplizierung und der aktive Push-Worker nochmals lesend abgeglichen. Die isolierte PostgreSQL-Probe wurde auf dem LIVE-Kandidaten wiederholt. Der Release-Plan führt ausschließlich den geprüften Blob `d299b7eedbd34a04eb09dac8fb02bc52287057cb` für diese Änderung.

## Option „Nur im Team-Feed“

Die optionale Zustellung wird im Bestätigungsdialog gewählt. Bei Feed-only entstehen weder Inbox-Einträge noch Push-Aufträge. Die gemeinsame Veröffentlichung bleibt die Voreinstellung. Isoliert geprüft wurden Feed-only, Wiederholung, die Ablehnung einer einzelnen leeren Versandnachricht und der bisherige Versandpfad. Auf LIVE wurden Funktionsrechte und Staff-RLS lesend abgeglichen. Geprüfter Migrationsblob: `05c3ae8277bac630a7ddaa4fe8a609b3e587c298`.
