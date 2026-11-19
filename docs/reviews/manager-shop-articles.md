# Artikelverwaltung im Manager (TEST)

Einstieg über Verein → Vereinsshop · Artikelverwaltung und direkt `/manager/vereinsshop`. Authentifizierte eigenständige Verwaltungsseite: Verein auswählen; vorhandene Shopverwaltung startet direkt im Verwaltungsmodus. Produktname, Endpreis, Größen, Foto-HTTPS-Link und Personalisierung anlegen. Bestehende Artikel bearbeiten sowie ein-/ausblenden; Bearbeiten erhält den Sichtbarkeitsstatus. Familienansicht ist verlinkt.

Die eigenständige Route erlaubt dem dedizierten Shopverantwortlichen den Zugriff, ohne allgemeine Manager-/Trainerrechte zu vergeben. Keine Änderung am allgemeinen ManagerAccessGate. Der bestehende `club_shop`-RPC entscheidet serverseitig, ob der aufrufende Nutzer Vereinsadmin oder zugeordneter Shopverantwortlicher für den gewählten Verein ist. manageOnly zeigt für Nichtberechtigte keine Katalog-/Bestellaktionen und keine Verwaltungsformulare. Vereinsauswahl unter bestehenden clubs-RLS; keine Service-Schlüssel oder neue Datenbankrechte. TEST-Grenze auf Seite und Navigation. LIVE-Datenbank unverändert.

Validiert: Shop-Interaktionstests einschließlich manageOnly für erlaubte/unerlaubte Nutzer, fokussierte TypeScript-Prüfung und Produktionsbuild. Fotos zunächst per HTTPS-Link; kein Upload neu eingebaut. Zuschussfunktion weiterhin separat offen.
