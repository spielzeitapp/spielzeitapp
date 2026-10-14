# Personenfreigaben für Teammusik und Spieltagsansagen

Test-only Umsetzung. Live bleibt unverändert.

Unter Verein verwalten → Vereinsdetail → Musik & Spieltagsansagen · Personenfreigaben stehen pro vorhandener Staff-Person zwei Schalter. Einstellungen gelten pro Verein, nicht global. Neue/fehlende Freigaben sind aus. Bestehende Plattform-/Vereinsadmins behalten Zugriff. Eine Freigabe erteilt keine Admin- oder anderen Trainerrechte und setzt vorhandene Staff-/Mannschaftszuordnung voraus.

Die Datenbank ist maßgeblich: RLS schützt die Freigabetabelle, Ansagenentwürfe und private Musikablage. Nur berechtigte Admins schreiben Freigaben. Eine zusätzliche Ansagenprüfung schützt KI-Aufrufe vor der Datenübermittlung an OpenAI. Die Oberfläche fragt die effektiven Rechte für die Mannschaftssaison ab, blendet Menü/Links aus und sperrt Direktaufrufe. Ansagen ohne Musikfreigabe haben keinen Player oder Musikmodus. Fehler und Mannschaftswechsel schließen den Zugang bis zur erfolgreichen Prüfung. Online werden Rechte beim Fensterfokus und spätestens alle 30 Sekunden aktualisiert.

Offline-Einschränkung: bereits heruntergeladene Dateien und lokale Vorbereitungen können nicht aus der Ferne zurückgerufen werden. Die eigenständige Offline-Seite ist ein lokaler Snapshot, kein online widerrufbarer Zugriff auf die Vereinsablage.

Prüfung: Produktionsbuild und 27 relevante automatisierte Tests erfolgreich. Staging-Datenbanktests in Transaktionen mit Rollback prüfen Default aus, keine Selbstfreigabe, Ansagen-only, Musik-only, beide an, Entzug beider Rechte, Admin-Ausnahme, gespeicherte Ansagen nach Entzug, Storage SELECT/INSERT ohne/mit Freigabe. Testdaten bleiben nicht gespeichert. Security-Advisor ohne relevante neue Befunde. Lokale Migrationsliste kann ohne lokale Docker-Datenbank nicht ausgeführt werden; Migration wurde per Supabase CLI erstellt und auf Staging per MCP angewendet.
