# Artikelverwaltung im Manager (TEST)

Einstieg über Verein → Vereinsshop · Artikelverwaltung und direkt `/manager/vereinsshop`. Authentifizierte eigenständige Verwaltungsseite: Verein auswählen; vorhandene Shopverwaltung startet direkt im Verwaltungsmodus. Produktname, Endpreis, Größen, Foto-HTTPS-Link und Personalisierung anlegen. Bestehende Artikel bearbeiten sowie ein-/ausblenden; Bearbeiten erhält den Sichtbarkeitsstatus. Familienansicht ist verlinkt.

Die eigenständige Route erlaubt dem dedizierten Shopverantwortlichen den Zugriff, ohne allgemeine Manager-/Trainerrechte zu vergeben. Keine Änderung am allgemeinen ManagerAccessGate. Der bestehende `club_shop`-RPC entscheidet serverseitig, ob der aufrufende Nutzer Vereinsadmin oder zugeordneter Shopverantwortlicher für den gewählten Verein ist. manageOnly zeigt für Nichtberechtigte keine Katalog-/Bestellaktionen und keine Verwaltungsformulare. Vereinsauswahl unter bestehenden clubs-RLS; keine Service-Schlüssel oder neue Datenbankrechte. TEST-Grenze auf Seite und Navigation. LIVE-Datenbank unverändert.

Validiert: Shop-Interaktionstests einschließlich manageOnly für erlaubte/unerlaubte Nutzer, fokussierte TypeScript-Prüfung und Produktionsbuild. Fotos zunächst per HTTPS-Link; kein Upload neu eingebaut. Zuschussfunktion weiterhin separat offen.


## Manager layout update

The dedicated TEST route now opens on Artikel. The single compact heading, club selector and family-shop preview replace the duplicate shop introduction. Artikel uses photo cards with visibility badges, sizes, prices and editing controls. The editor opens on demand. Bestellungen holds the existing rounds, payment confirmation, release and collection workflow. Einstellungen holds the existing admin-only account and role settings. Non-admin shop managers see an explanation instead of the settings form.

Validation: club-shop role/navigation and checkout tests, tab separation, add/edit controls, preservation of hidden product state, focused TypeScript check, production Vite build. No database or payment behavior changed.
