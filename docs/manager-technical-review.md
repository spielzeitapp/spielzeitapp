# Technische Freigabe im TEST-Manager

Nur ein serverseitig verifizierter Plattformadmin im TEST-Projekt darf starten oder freigeben. Der Button startet einen auf main installierten Workflow mit TEST-SHA, LIVE-SHA und Plan-Digest. Er liest ausschließlich LIVE-Katalogmetadaten (Tabellen-/Spaltennamen, Typen und Enums), keine Geschäftsdaten. Kandidaten-Skripte werden nicht ausgeführt. Der SQL-Test läuft in einem separaten Job ohne Supabase-Zugangsdaten.

Automatisch freigabefähig sind neue einfache Spalten mit festen Vorgaben und begrenzten Prüfregeln sowie nicht eindeutige, einfache B-Tree-Indizes. Änderungen/Löschungen vorhandener Spalten, Rechte, Funktionen, Datenkorrekturen, neue Tabellen, Fremdschlüssel und komplexe SQL-Anweisungen bleiben gesperrt und benötigen technische Prüfung. Das ist eine bewusste Grenze, keine umfassende automatische SQL-Sicherheitsprüfung.

Der Parser verwirft die gesamte Datei, sobald ein nicht unterstützter Befehl enthalten ist. Zulässige SQL-Dateien werden gegen leere Tabellen mit aktuellen LIVE-Spaltentypen und einer synthetischen Zeile ausgeführt. Bestehende LIVE-Constraints, RLS, Dateninhalte und die vollständige Laufzeitumgebung werden nicht nachgebildet. Der anschließende normale Veröffentlichungsablauf prüft Build und Tests erneut und wendet ausschließlich exakt freigegebene Blobs atomar an.

Der Manager lädt den Bericht nur aus dem Artefakt eines erfolgreichen workflow_dispatch-Laufs des installierten main-Workflows. Abgelaufene Berichte (1 Stunde), andere Quellstände, fehlende Artefakte, nicht bestandene Berichte und offene weitere Sperren können nicht freigegeben werden. Freigabe braucht ein separates Häkchen und einen Klick. Sie erstellt einen nachvollziehbaren Commit auf develop mit den exakten Blob-SHAs und Admin-/Laufreferenz; es erfolgt kein LIVE-Schreibzugriff. Ein paralleles develop-Update verhindert den non-force Commit. Danach müssen die Bereitstellungsprüfungen für den neuen Commit erneut erfolgreich werden.

## Lokale Prüfungen

- `node --test scripts/release/*.test.cjs scripts/serverless-routing.test.cjs`
- `PYTHONPATH=/tmp/review-parser python scripts/release/review-sql-test.py` (extern installiertes `pglast==7.22`)
- Isolierter Worker: `review-live-schema.mjs check` mit einem synthetischen Bundle und externem `@electric-sql/pglite@0.3.14`.
- Konfigurierter Typecheck und Produktionsbuild.
