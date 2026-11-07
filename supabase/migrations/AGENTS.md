# Migrationen und LIVE-Freigaben

Zu jeder neuen Datenbankänderung gehört die technische Prüfung im selben Entwicklungsauftrag. Eine Manager-Veröffentlichung darf keine ungeprüften SQL-Dateien benötigen, ohne dass dies ausdrücklich als offen gemeldet wird.

- Vor Freigabe aktuelle LIVE-Struktur, betroffene Rechte/RLS und Abhängigkeiten ausschließlich lesend prüfen. Keine TEST-Spieler, Spiele, Vereine oder fest eingetragenen TEST-Gestaltungswerte nach LIVE übernehmen.
- Migrationen mit passenden synthetischen Fällen isoliert proben: erlaubter Aufruf, nicht berechtigter Nutzer, ungültige Werte, Wiederholung und konkurrierender/veralteter Speicherstand. Bei neuen Invoker-RPCs insbesondere die tatsächlichen LIVE-Tabellenrechte und RLS prüfen; ein Admin-Test mit ausgeschalteter RLS genügt nicht.
- Nur tatsächlich geprüfte Dateien mit ihrem exakten Git-Blob-Hash in `release/live-plan.json` freigeben; Prüfumfang und Grenzen in einem Review-Nachweis dokumentieren. Ein grüner Build ersetzt keine SQL-/Berechtigungsprüfung. Bei fehlender Prüfung keine Hashes pauschal ergänzen.
- Bereits in LIVE ausgeführte oder eingefrorene Migrationen nicht umschreiben. Notwendige Korrekturen als neue Migration anlegen. Korrekturen einer noch nicht LIVE veröffentlichten Datei ausdrücklich dokumentieren; TEST-Historie nicht rückwirkend als LIVE-Ausführung ausgeben.
- Technische Freigabe und tatsächliche LIVE-Veröffentlichung sind getrennte Schritte. Bestehende Veröffentlichungs- und Admin-Prüfungen beibehalten.
