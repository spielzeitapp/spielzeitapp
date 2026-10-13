# Vereinskommunikation auf Test

Die erste ausführbare Version liegt ausschließlich auf develop / app.spielzeitapp.at. Datenbank: Staging acbaecjzoabafbsjrzvr. Keine Veröffentlichung auf main.

## Enthalten
- Vereinsmedien: Grafikvorschau und PNG-Export, Vereinsfarben, kopierbarer Text, gespeicherte Textentwürfe mit Versionsprüfung. Eigene Bilder müssen nach Laden erneut ausgewählt werden.
- Social Media: gespeicherte Medienentwürfe auswählen und Texte für manuelles Posten kopieren. Keine OAuth-Verbindung oder Direktveröffentlichung.
- Sprecherstudio: Spielauswahl, eigene abgeschlossene Ergebnisse und nächste Termine laden, Tagesangaben ergänzen, 11 Vorlagen, geschützte eigene Änderungen, Abschnittsfreigabe, Schnelldurchsagen, Druck/PDF und Großansicht.
- Musik: zwei Player mit Position, Lautstärke, Überblendung, Sprachabsenkung, sechs manuell ausgelöste Jingle-Tasten und Alles-Stopp. Dateien bleiben im Browser auf diesem Gerät, getrennt nach Konto und Mannschaft. Player- und Jingle-Zuordnungen werden beim erneuten Öffnen neu gewählt.
- Entwürfe liegen pro Konto und Mannschaft in manager_communication_drafts. RLS prüft Eigentümer, operablen Verein und bestehenden Verwaltungs-/Trainerzugriff. Revision verhindert unbemerkte Überschreibung.

## Noch offen
- Externe KI-Erstellung: Deployment durch automatische Freigabeprüfung blockiert, weil Mannschafts-/Spieldaten und bearbeitete Texte an OpenAI übertragen würden. Funktion ist nicht veröffentlicht; Buttons sind deaktiviert.
- Vereinsweite Medien-/Sprecherrollen, gemeinsames Redaktionsfreigabesystem, Cloud-Medienbibliothek.
- Direktes Posten und Planung für Meta, WhatsApp-Anbindung.
- Vollständiger ÖFB-Import einschließlich Tabelle, Gegnerhistorie, Reserve und bestätigter Aufstellungen. Derzeit vorhandene eigene Spieldaten plus manuelle Angaben.
- Persistente Pad-/Playlist-Zuordnungen, automatische Cue-Steuerung, Wellenformen.

## Prüfung
Node: node --experimental-strip-types --test scripts/club-communications-model-test.mjs
Sechs Modelltests: Zeitzonen, manuelle Spielphasen, offene Angaben, Erhalt eigener Texte, eindeutige Abschnitte, Crossfade/Sprachabsenkung.
Staging-Transaktion (Rollback): Insert, Update/Revisionsinkrement, Konflikt bei alter Revision, Eigentümerwechsel blockiert, Lesen/Schreiben ohne Berechtigung blockiert.
Browser-Tests hinter dem Login benötigen eine authentifizierte Sitzung; Audiowiedergabe zusätzlich mit der tatsächlichen Stadionanlage prüfen.
