# Bildschirmmodus für Turniere auf LIVE

Die unveränderte TEST-Migration `20261116120000_tournament_screen_access.sql` hat den Git-Blob `ba71c6fee17a9ad48b2cbe4ecfbadad97ca61781`. Auf LIVE wurden die referenzierten Tabellen und Spalten, aktives RLS und die Admin-Funktion lesend geprüft. Die Migration legt eine RLS-geschützte Zuordnungstabelle ohne direkten Zugriff für App-Rollen an. Die RPCs prüfen Benutzer und Turnier. Die Zuordnung ist durch den zusammengesetzten Primärschlüssel und `ON CONFLICT DO NOTHING` idempotent.

Der SQL-Test auf TEST lief in einer zurückgerollten Transaktion unter den Rollen `authenticated` und `anon`. Er deckt Vereins- und Plattformadmins, Trainer mit und ohne Zuweisung, fremde Benutzer, Ereignisgrenzen, unzulässige Zuweisungen, wiederholtes Zuweisen und Entfernen sowie den verweigerten Direktzugriff auf die Tabelle ab. Die öffentliche Turnierseite, QR und PDF bleiben ohne Anmeldung erreichbar.

Die Freigabe gilt für die Turnierseite und den Bildschirmmodus. Mannschaftsmeldung und eigenständige Zuschauer-App sind weiterhin TEST-Piloten. Ein Gerätetest mit iOS und AirPlay steht aus.
