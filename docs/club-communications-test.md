# Vereinskommunikation auf Test

Stand 14.10.2026. Nur develop / app.spielzeitapp.at; Staging acbaecjzoabafbsjrzvr. main unverändert.

## Sprecherstudio: Musik testen
1. Manager → Sprecherstudio öffnen.
2. Testlieder hinzufügen: zwei kurze, leise Testmelodien und ein Test-Jingle werden ausschließlich lokal erzeugt. Es sind keine vollständigen Lieder.
3. Playlist Pause → Playlist starten. Der zweite Titel startet automatisch. Pause/Weiter, nächster Titel, Wiederholen und Alles STOPP testen.
4. Eigene MP3/WAV/M4A/OGG/AAC-Dateien bis 25 MB über Audiodateien hinzufügen laden. Dropbox-Dateien zuvor auf das Gerät herunterladen.
5. Mit + Pause (bzw. Vor dem Spiel/Nach dem Spiel) hinzufügen; Reihenfolge mit Pfeilen ändern.
6. Jingles den sechs Tasten zuordnen. Playlists, A/B-Auswahl und Pad-Zuordnungen werden auf dem Gerät gespeichert.
7. Einzelne Dateien in Vereinsablage speichern; danach Playlist in Vereinsablage sichern. Auf einem anderen Gerät die private Vereinsablage aktualisieren und die Playlist Auf Gerät speichern. Alle zugehörigen Lieder werden lokal geladen.
8. Offline vorbereiten speichert die aktuelle Sprechertextkopie und den eigenständigen Player. Offline-Seite öffnen und als Lesezeichen speichern. Vor dem Einsatz ohne Internet testen.

## Offline-Grenzen
- Die Offline-Seite enthält Musik, Playlist, Jingles und eine lokale Kopie der Texte. Sie lädt ohne Manager-Anmeldung und greift ausschließlich auf vorbereitete Daten dieses Geräts zu.
- Gemeinsamer PC: lokale Daten bleiben nach Abmeldung verfügbar. Browserdaten löschen entfernt lokale Musik und Texte.
- Kein ÖFB-Update, keine KI, keine Cloud-Speicherung und kein Abgleich von Textänderungen im Offline-Modus.
- A/B-Player und manuelle Überblendung im Online-Manager. Offline-Player verwendet einen Musikplayer mit unabhängigen Jingles; automatisches nächstes Lied, keine automatische A/B-Überblendung.
- Musik startet nur per Taste; Browser, Dateiformat und Anlage vor Einsatz prüfen.

## Daten und Rechte
- Privater Bucket speaker-audio, pro Verein getrennt. Bestehende Trainer-/Vereinsverwaltungsrechte werden geprüft. Kein Eltern-/Fan-Zugriff.
- Nur der Uploader kann seine Dateien ersetzen/löschen; andere berechtigte Vereinsverantwortliche können herunterladen.
- Cloud-Playlists enthalten ausschließlich Titel und Storage-Pfade, keine Sprechertexte.
- Lokales Entfernen löscht keine Vereinsdatei.
- KI-Sprechertexte aktiv auf Test nach ausdrücklicher Freigabe; serverseitige OpenAI-Anbindung und Schutz eigener Texte.
- Entwürfe bleiben konto-/mannschaftsbezogen mit Versionsprüfung.

## Prüfung
- Node-Modelltests: Zeitberechnung, Textschutz, Audiopegel; Playlist-Ende/Wiederholung, Reihenfolge, WAV-Header und Datenvalidierung.
- Offline-Worker getestet: Player-Cache und Offline-Fallback, keine API-Antworten im Cache.
- Offline-UI im simulierten DOM getestet: Texte wiederherstellen, nächster Titel, STOPP während einer verzögerten Play-Anfrage.
- Staging-RLS-Transaktionen mit Rollback: Trainer lesen/schreiben, unberechtigter Nutzer blockiert, falscher Uploader-Pfad blockiert.
- Esbuild-Bundleprüfung erfolgreich. Tatsächliche Browser-/Lautsprecherwiedergabe ist noch vor Ort zu testen; lokaler Chromium-Test mangels verfügbarem Browser blockiert.

## Offen
Vereinsweite Medien-/Sprecherrollen, vollständiger ÖFB-Import mit Tabelle/Reserve/Aufstellungen, direktes Social-Media-Posten, automatische DJ-Überblendung.
