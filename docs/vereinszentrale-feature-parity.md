# Vereinszentrale — vollständige Manager-Anbindung

Stand: 09.11.2026. Ziel: `/vereinszentrale/manager`, TEST. Originalansicht: `/manager`.

## Umsetzung

Die Vereinszentrale rendert sämtliche bestehenden Manager-Routen über dieselbe Routendefinition in `src/app/App.tsx`. Sie verwendet dieselben Editoren, Hooks, Berechtigungen und denselben Supabase-Client. Es gibt keine zweite Datenbank, keinen Datenexport/-import und keine Kopie von Spielern. Änderungen an TEST-Daten sind in beiden Ansichten sichtbar. LIVE wird dadurch nicht verändert.

| Bereich | Bestehende Funktionen in der Zentrale |
| --- | --- |
| Vereine | Setup, Logo/Farben, Module, Mannschaften, Trainer/Zugänge, Einrichtungscheckliste, App-Vorschau |
| Mannschaft/Saison | Kader, Spielerprofile, Trainerprofile, Mannschaftsfoto, Fotogestaltung, Fotobox/Fernsteuerung, Eltern-/Spielerzugänge |
| Organisation | Termine, Wochenkalender, Platzbelegung, Sportanlagen, Konflikte |
| Sport | Spiele, Turniere, Vorbereitung, Aufstellung, Live-Spieltag, Berichte, Tabelle/Liga, Videos/Analyse |
| Training | Planung, Editor, Übungsbibliothek, Vorlagen, Chronik, bestehende Dokumentation |
| Saison | ÖFB-Import, Spielerzuordnung, Synchronisierung, Saisonassistent, Wechsel und Archiv |
| Kommunikation | Feed, Medien, Social Media, Musikplayer, Spieltagsansagen, Team-Push, Erinnerungen, Benachrichtigungen |
| Plattform | Vereinsübersicht, bestehende TEST-/LIVE-Prüfung und Veröffentlichung, nur mit bestehenden Adminrechten |
| Persönlich | Bestehende Favoriten, Rollen-/Kontextwahl und Einstellungen |

Alle freigegebenen Bereiche sind über die Bereichssuche erreichbar. Die Suche verwendet den vorhandenen Navigationskatalog und dieselben Modul-/Rollenfilter; sie ersetzt keine serverseitigen Prüfungen. Kontextbezogene Reiter und Pfadnavigation gelten auch auf Unterseiten. Detailverweise zu Teams, Profilen und Terminen sowie Fotobox-Kopplungslinks behalten den zentralen Pfad.

Das zentrale Tag-/Nachtthema gilt für alle neutralen Karten, Tabellen, Eingaben und Dialoge einschließlich Body-Portals. Spezialoberflächen für Medien, Social Media und Spieltagsansagen sind ebenfalls angebunden. Der Musikplayer verwendet in der Zentrale denselben Tag-/Nachtzustand. Semantische Grün-/Orange-/Rotzustände und die Deck-/Transportfunktionen bleiben unterscheidbar. Druckgrafiken, Spieler-/Trainerkarten, Foto-/Kamerabereiche behalten ihre eigene Gestaltung.

## Datenprüfung

Read-only Abfrage auf TEST-Projekt `acbaecjzoabafbsjrzvr`, keine Schreiboperation:

| Verein | Mannschaften | Team-Saisonen | Verschiedene Kaderspieler | Termine |
| --- | ---: | ---: | ---: | ---: |
| NSG Gölsental | 2 | 3 | 28 | 47 |
| SC Melk | 1 | 1 | 18 | 6 |
| USC Rohrbach | 3 | 2 | 29 | 35 |

Diese vorhandenen Datensätze sind dieselben, die die Original-Managerkomponenten laden. Sichtbarkeit hängt unverändert von Anmeldung, Vereins-/Mannschaftskontext und bestehenden Rechten ab. Die Zahlen sind Prüfbelege dieses Zeitpunkts, keine fest codierten Produktdaten.

## Verifikation

- Build und bestehender Projekt-Typecheck erfolgreich. Der Projekt-Typecheck hat weiterhin seinen vorhandenen Feed-Einstieg; die Routentests bündeln den neuen Workspace zusätzlich mit esbuild.
- `central-workspace-test.mjs`: alle freigegebenen Katalogeinträge lösen zu realen Manager-Routen auf; Rollen-/Modulfilter, Suchalias Kader, gemeinsame Editorkinder, zentrale Deep Links und Portal-Fallback erfolgreich.
- Vergleichsrouting, Vereinsfarben/Kontrast, mobile Navigation/Favoriten, Mannschaftsauswahl/Archiv, Fotobox, Fotoformat-Vererbung und Saisonassistent erfolgreich.
- Browser-Sichtprüfung der Entwicklungsfixture (explizit Beispieldaten): Schwarz/Weiß und Blau/Gelb, Tag/Nacht, Desktop und 390px breite Handyflächen; Eingaben, Ampel, Suchpanel, Dialog und unveränderte Grafikfarben geprüft. Mobiler Inhalt nach Korrektur ohne horizontalen Seitenüberlauf (375px Inhalt/375px verfügbar); Bereichsreiter scrollen separat.
- Bestehender `trainer-photo-layout-test.cjs` erwartet acht Regler, während der unveränderte Editor bereits neun liefert; dieser alte Test ist nicht Bestandteil der erfolgreichen Check-Suite. Kein Editor-Regler wurde durch diesen Umbau entfernt.
- Ein vollständiger angemeldeter Browserdurchlauf mit echten Vereinsdaten ist noch offen: der verfügbare Prüfbrowser zeigt die normale Anmeldung. Keine Loginumgehung und keine Änderung an Auth/RLS.

## Vergleich und Veröffentlichung

Nur nach `develop`/TEST bereitstellen. Die alte Manager-Oberfläche erhält weder den zentralen Seitenrahmen noch die neuen CSS-Selektoren. Die neuen Portal- und Linkhelfer verwenden außerhalb der Zentrale den bisherigen Body-/App-Pfad. Ein späterer Vergleich ist jederzeit mit derselben Anmeldung und demselben TEST-Datenstand möglich.
