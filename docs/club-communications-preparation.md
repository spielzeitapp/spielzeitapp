# Vereinsmedien, Social Media und Sprecherstudio – Umsetzungspaket

Stand: 13.10.2026, Europe/Vienna. Status: **Vorbereitung, keine neue Produktfreischaltung**.

## Ausgangslage und Grenzen dieses Pakets

Geprüfter Test-Stand: `b709e394c1e8d4dde63123e5cf2dcd88969f458f`.
Geprüfter Live-Stand: `4c7ffb05935b81586c77d55b1be5990f0213fea7`.

| Bereich | Im geprüften Code vorhanden | Noch umzusetzen |
|---|---|---|
| Vereinsmedien | Test: ManagerMediaStudioPage, Spieltag/Ergebnis/Vereinsnachricht, manuelle Entwürfe, ausgewählte Team-Events, PNG-Export, Beitrag/Story, bearbeitbare Textvorlagen | Dauerhafte Entwürfe, automatische Vereinsmarke, weitere Autopost-Vorlagen, eigener Medienzugang |
| Social Media | Grafikdownload und Textkopie; vorhandene Feed-Teilen-Funktion | KI-Texte, Kontoverbindungen, Veröffentlichung und Planung |
| Sprecherstudio | Vom Nutzer bestätigte Gestaltungsentwürfe und PDF-Ablauf als fachliche Vorlage | Seiten, Datenhaltung, KI-Funktion, Audio, eigener Sprecherzugang |
| KI | Geschützter Client und Edge Function für Trainingskurztexte im Repository | Laufende Konfiguration/Secrets prüfen; neue Kommunikationsfunktion unabhängig implementieren |
| Design | clubBranding-Service mit Haupt-, Zweit-, Akzentfarbe und Logo | Studio-Entwürfe automatisch anbinden, bestehende hartcodierte rote Poster getrennt nachziehen |
| Zugänge | Bestehende Manager-Staff-/Admin-Logik | Medien/Sprecher dürfen nicht durch Trainer-/Adminrechte simuliert werden |

Repository-Prüfung beweist nicht, dass DB-Migrationen, Secrets oder externe Konten produktiv eingerichtet sind.
Dieses Paket ergänzt nur ein nicht angeschlossenes Modell, Tests und diesen Bauplan.
Keine neuen Routen, DB-Migrationen, OAuth-Verbindungen, API-Aufrufe oder Veröffentlichungen.

## Bereits vorbereitete Bausteine

- `src/lib/clubCommunicationsModel.ts`: Vertragsmodell für Entwürfe, Quellen, Sprecherabschnitte,
  Veröffentlichungsaufträge und Audioassets.
- Elf Sprecherabschnitte aus dem bereitgestellten Beispiel, ohne historische Sponsorennamen
  oder Spielerwerte fest in den Produktcode zu übernehmen.
- Relative Zeiten: Begrüßung -15, Hymne -12, Sponsoren -10, Gastaufstellung -7,
  Heimaufstellung -5, Schiedsrichter -4, Einlauf -2, Ehrenanstoß/Anpfiff 0 Minuten.
- Halbzeit, zweite Halbzeit und Spielende werden durch den tatsächlichen Verlauf ausgelöst.
- Zeitberechnung mit expliziter Zeitzone und Anzeige in Europe/Vienna.
- Fehlende Fakten bleiben `[OFFEN: ...]`; eine vorhandene Null ist ein gültiger Zahlenwert.
- Regenerierung schützt manuell bearbeitete und freigegebene Abschnitte; gezielte Ersetzung
  setzt den Abschnitt wieder auf `needs_review`.
- Gleichleistungs-Überblendung A/B und Musikabsenkung (Standard 20 %).
  Das ist nur die Pegelberechnung, kein Audioplayer.
- Sechs automatisierte Tests sind erfolgreich.

Testaufruf (Node mit Type-Stripping, geprüft mit Node 24):

```sh
node --experimental-strip-types --test scripts/club-communications-model-test.mjs
```

## Zieloberflächen

### Vereinsmedien: /manager/vereinsmedien

Helle Arbeitsfläche, dunkle Navigation, Vereinsakzente. Links Inhalt, rechts Grafik und Text.
Vorlagen: Spieltag, Ergebnis, Aufstellung, Kader, Vereinsnachricht.
Auswahl öffentlicher/bestätigter Spielinfos statt erneuter manueller Dateneingabe.
Originale Vereins- und Gegnerlogos; hochgeladene eigene Bilder bleiben unverändert.
Schwarze Grundfläche, farbige Akzente. Blau/Gelb darf keine rot eingebrannte Bilddatei verwenden:
neutrale Textur plus überlagerte, variable Streifen. Demo-Trikots mit unpassender Farbe nicht
automatisch verwenden; neutraler Ersatz oder passende explizit ausgewählte Variante.
Gespeicherte Entwürfe, Vorschau 4:5/9:16, Download, Textkopie und Geräte-Teilen, soweit unterstützt.
Export ohne Bedienelemente und ohne abgeschnittenen Inhalt.

### Social Media: /manager/social-media

Entwürfe, Statusübersicht, Freigabe und Kanalverwaltung.
WhatsApp zunächst über Grafikexport/Textkopie/Geräte-Teilen.
Eine direkte WhatsApp-Kanalveröffentlichung wird NICHT als vorhandene oder verfügbare API angenommen.
Facebook-Seiten und Instagram-Konten erst nach Prüfung der aktuellen offiziellen Plattformanforderungen
anbinden; verfügbare Beitragstypen dynamisch anzeigen.
Keine bloßen Links zu Facebook/Instagram als angeblich direkte Veröffentlichung ausgeben.
Kein Posten ohne vom Nutzer ausgewählte Ziele und bestätigte Entwurfsrevision.

### Sprecherstudio: /manager/sprecherstudio

Vorbereitung: Spiel wählen, Fakten aktualisieren, Quellenstand anzeigen, Tagesangaben ergänzen,
Sprechertexte erstellen, prüfen, ändern, freigeben.
Sprechermodus: links Ablauf, große Textkarte, nächste/vorige Karte und Vollbild.
DJ-Bereich: zwei Decks A/B, Wellenform/Fortschritt, getrennte Lautstärke, Crossfader,
Sprechen/Musikabsenkung, Jingle-Pads und ALLES STOPP.
Die Sprechen-Taste steuert App-Musik; sie ersetzt oder öffnet nicht automatisch das physische Mikrofon.
Große Schnellaktionen für Heimtor, Gasttor, Wechsel, Lenkeraufruf und geprüfte Notfalltexte.
Tablet: zwei umschaltbare Ansichten Text/Audio; ALLES STOPP bleibt erreichbar.
Kein automatischer Start bei Uhrzeit, Torereignis oder Wechsel des Abschnitts.

## Gemeinsames Datenmodell (Design, noch kein SQL)

| Geplante Tabelle | Kernfelder | Zweck |
|---|---|---|
| club_communications_settings | club_id, settings, revision, updated_by, updated_at | Vereinsname für Durchsagen, Sprechstil, Standardtexte, Vorlagen |
| club_communications_grants | club_id, user_id, capabilities, team_scope, revoked_at | Vereinsbezogene Medien-/Sprecherrechte |
| club_supporters | club_id, name, spoken_name, standard_text, active_from, active_until | Wiederverwendbare Sponsoren mit Gültigkeit |
| event_supporter_assignments | club_id, event_id, supporter_id, kind, present, confirmed_by | Tagesbezogene Schirmherrschaft, Patronanz, Ballspende, Anwesenheit |
| club_media_drafts | club_id, team_season_id, event_id, template, format, payload, revision, sources, status | Grafik- und Textentwürfe |
| club_speaker_programs | club_id, event_id, revision, facts_snapshot, created_by | Vollständiger Sprecherablauf je Spiel |
| club_speaker_sections | club_id, program_id, section_key, sort_order, offset_minutes, trigger, text, status, edited_by_user, audio_asset_id | Einzeln bearbeitbare/freigegebene Abschnitte |
| club_audio_assets | club_id, storage_path, name, mime_type, duration, file_size, checksum | Fertige Suno-Musik und Jingles |
| social_connections | club_id, provider, remote_account_id, status | Öffentlich benötigte Verbindungsmetadaten, KEINE Tokens |
| social_publications | club_id, draft_id, approved_revision, target, run_at, idempotency_key, state, remote_id, last_error | Veröffentlichung mit nachvollziehbarem Status |
| communication_generation_jobs | club_id, actor_id, source_revision, kind, state, usage, created_at | Wiederholungsschutz, Kostenkontrolle, Audit |

UUIDs und existierende Club-/Team-/Eventbeziehungen beim Migrationsbau prüfen.
club_id in Kindtabellen über zusammengesetzte Beziehungen oder serverseitige Prüfungen konsistent halten.
Revisionen optimistisch prüfen: Änderungen auf veraltetem Stand ergeben Konflikt, keine stille Überschreibung.
Freigaben beziehen sich auf eine konkrete Revision; Text-, Grafik- oder Faktenänderungen erfordern neue Freigabe.
Export ist nicht gleich Veröffentlichung. `published` nur nach bestätigtem Ergebnis der Plattform.
Kein automatischer Import historischer Sponsoren/Anwesenheit aus dem Beispiel in aktuelle Spiele.

## Zugänge und Datenschutz im Produkt

| Zugriff | Medien | Social veröffentlichen | Sprechertexte | Audio/Livebetrieb |
|---|---|---|---|---|
| Vereinsadmin | im eigenen Verein | eigene Ziele nach Verbindung | im eigenen Verein | verwalten |
| Medienbeauftragter | freigegebene Teams, öffentliche Spieldaten | nur mit extra social.publish | nur mit extra speaker.edit | nur mit extra audio.manage |
| Stadionsprecher | kein allgemeiner Medienzugriff | nein | zugewiesene Spiele | speaker.operate, ggf. audio.manage |
| Trainer | eigene Teams wie bisher | nur zusätzlich ausdrücklich erteilt | nur zusätzlich ausdrücklich erteilt | nur zusätzlich ausdrücklich erteilt |
| Eltern/Spieler/Fans | kein Manager-Studio | nein | nein | nein |
| Plattformadmin | bestehender expliziter Vereins-/Supportkontext | keine stillen Veröffentlichungen | bestehender Supportkontext | keine stillen Wiedergaben |

Medien-/Sprecherrechte als neue, clubbezogene Fähigkeiten einführen, bestehende Rollen unverändert lassen.
ManagerAccessGate, WorkMode, Sidebar, ManagerTeamScope und Backendzugriffe gemeinsam anpassen.
Für Sprecher nicht zwingend eine eigene Trainer-Membership anlegen.
Quelle für Medien/Sprecher auf öffentliche Spielinformationen, freigegebene Aufstellungen/Ergebnisse begrenzen.
Keine Elternkontakte, medizinischen Angaben, Anwesenheitsgründe oder private Trainerkommentare ausliefern.
RLS/Backendprüfung auf jede Tabelle, RPC, Funktion und private Storage-Datei; serverseitige Club-Zugehörigkeit.
UI-Ausblenden ist keine Autorisierung. Neue Module bei fehlender Rechteprüfung nicht als aktiv behandeln.
Rechteentzug sperrt neue Operationen auch bei vorhandener Browseransicht.

## KI-Anbindung

Neue geschützte Kommunikationsfunktion, nicht die Trainings-Kurzfassungsfunktion zweckentfremden.
Vor API-Code zunächst Schlüssel-/Projektkonfiguration prüfen; keine Schlüssel im Chat oder Repository.
Server lädt/verifiziert den autorisierten Verein, die zugelassenen Events und bestätigten Fakten.
Browser übermittelt IDs/Revisionen und bearbeitbare Tagesangaben, keine ungeprüfte Fremdclub-Quelle.
Nur notwendige freigegebene Informationen an die KI senden.
Sprecherstil: österreichisch, freundlich, gut sprechbar, kurze Absätze; Beispiele
„grias eich“, „unsere Burschen“, „pfiat eich“. Namen und Spielzahlen bleiben Fakten, keine stilistische Erfindung.
Strukturierte Ausgabe mit section IDs, Texten, Quellenbezügen und offenen Punkten.
Zahlen/Datum/Gegner/Spielstand gegen Quellen prüfen. Semantische Prüfung und menschliche Freigabe ergänzen;
eine Quellen-ID allein beweist nicht, dass ein Satz faktisch stimmt.
Optionale fehlende Sponsorblöcke bewusst auslassen; Pflichtdaten als offen markieren.
Keine extern recherchierten oder erfundenen Fakten ohne separate belegte Quelle.
Bereits bearbeitete Abschnitte bei Sammel-Regenerierung erhalten.
Kosten-/Anfragelimit serverseitig pro Verein, Jobs wiederverwenden, Modell konfigurierbar.
Bei Timeout/Limit/fehlendem Key: verständliche Meldung, bestehende Texte und manuelle Bearbeitung erhalten.
KI-Entwurf nie automatisch als freigegeben markieren.
Suno: vorhandene Audiodateien verwenden; keine nicht geprüfte Suno-Erstellungs-API voraussetzen.

## Spielinfos und Quellenstand

Bestehende Services wiederverwenden:
- `useEvents` für bestätigte Termininfos; keine internen open/agreed-Entwürfe für Medien.
- `championshipFixtures.ts` für ÖFB-Spielplan und Ergebnisimport.
- Bestehende Tabellen-/Ergebnisansichten als Grundlage für einen geprüften Datenadapter.
- Bestätigte eigene Aufstellungen und Matchereignisse für Live-Sprechertexte.
- `clubBranding.ts` für gespeichertes Vereinslogo und Farben.

ÖFB-Tabelle/Ergebnisse, Termin, Kader und Sponsoren erhalten getrennte Quellenzeitpunkte.
„Spielinfos aktualisieren“ lädt einen neuen Snapshot; vorhandene Freigaben werden bei Faktenänderungen ungültig.
Ergebnisse müssen zum richtigen Heim-/Auswärtsteam gehören, nicht nur zum Verein.
KM und Reserve getrennt referenzieren; Reservezeiten niemals aus KM-Uhrzeit ableiten.
Vorschau nur auf bestätigte zukünftige Spiele/Termine im berechtigten Vereinskontext.
Bei fehlender bestätigter Startzeit keine 00:00-Sentinel als Anpfiff durchsagen.
Halbzeit/Ende manuell oder aus bestätigter Matchphase, nicht starr 45/90 Minuten nach Anpfiff.
Bei Halbzeit anderer Gegner, falschem Bewerb oder Datum/Wochentag-Widerspruch warnen und Freigabe blockieren.

## DJ-Player und Audiobibliothek

- Fertige Dateien hochladen; unterstützte Formate/Größen/Dauer im Zielbrowser prüfen und klar begrenzen.
- Private, clubbezogene Audiodateien; Metadaten/Datei zusammen sicher löschen.
- A/B laden, Start/Pause, Stop/auf Anfang, Suchen, Lautstärke, Loop optional.
- Crossfade mit sanften Gain-Ramps; Master-Headroom/Begrenzung gegen Übersteuerung.
- „Sprechen“ senkt die Musik weich ab; beim Ausschalten bisherigen Pegel wiederherstellen.
- Unabhängiger Jingle-Bus, einzelne Pads umschaltbar, laufender Pad klar sichtbar.
- ALLES STOPP stoppt A, B, Pads und laufende Übergänge; bedienbar ohne Dialog.
- Wiedergabe erst nach Nutzeraktion. Startfehler (Browser-/Gerätebeschränkung) sichtbar anzeigen.
- Wechsel des Spiels/Vereins oder Logout beendet Playback und verwirft alte Audioquellen.
- Abschnitte verknüpfen Cues, starten sie aber nicht ungefragt.
- Keine angenommene automatische Mikrofonaufnahme oder Sprachausgabe.
- Offline-Paket explizit herunterladen: freigegebene Texte und ausgewählte Audioassets.
  Verfügbarkeit anhand tatsächlicher lokaler Bytes prüfen, nicht nur aus Metadaten.
- Geschützte Dateien nicht pauschal im globalen Service-Worker-Cache ablegen.
- Offline-Änderungen/Wiederverbindung mit Versionsprüfung statt letzter-Schreibzugriff-gewinnt.
- PDF/Word als Textreserve; große gut lesbare Karten und Großansicht unabhängig von Audio.

## Social-Veröffentlichung

Offizielle Anbieteranforderungen vor Implementierung erneut prüfen:
Kontotypen, benötigte App-Freigaben, verfügbare Medienformate, Uploadverfahren,
Berechtigungen und Tokenlebenszyklus. Vorbereitete Zieltypen sind ein Design, keine Zusage ihrer Verfügbarkeit.
OAuth-Verbindung nur durch berechtigte Vereinsverantwortliche; state/Callback/Vereinsbindung prüfen.
Tokens serverseitig verschlüsselt/private halten; dem Browser nur Kontoname und Verbindungsstatus zeigen.
Preview + Zielwahl + bestätigte Revision sind Voraussetzung für jeden Publish-Auftrag.
Idempotente Jobs, keine doppelten Beiträge bei Retry oder unklarer Antwort.
Bei unklarem Status zuerst Status prüfen, nicht blind neu senden.
Geplante Beiträge verwenden die freigegebene Revision; bei Änderungen pausieren und neu bestätigen lassen.
Zeit intern UTC, Anzeige Europe/Vienna; Sommer-/Winterzeit testen.
Abbrechen, Tokenwiderruf, Rechteentzug und deaktivierter Verein stoppen wartende Jobs.
Remote-ID und URL erst nach tatsächlicher Bestätigung anzeigen; Fehlerstatus mit erneuter Prüfung.
Keine externen Posts im Rahmen dieser Vorbereitung.

## Bauabschnitte und Abnahme

### P1 – Vereinsmedien fertigstellen
- [ ] Vertragsmodell an UI anbinden.
- [ ] Vereinsmarke laden, eigene Änderungen als gezielte Überschreibung behandeln.
- [ ] Entwürfe/Bilder dauerhaft speichern; Teamwechsel/Logout und Versionskonflikte prüfen.
- [ ] Vorhandene Kader-/Aufstellungs-/Ergebnisartworks wiederverwenden statt neue parallel bauen.
- [ ] Vollständige Namen/Torzeiten, beide Formate und Export auf iPhone/iPad/PC prüfen.
- [ ] Medienzugang mit Club- und Teamscope einführen.

Abnahme: Entwurf nach Neuladen wieder da; anderer Verein liest/verändert ihn nicht;
Grafikexport ohne abgeschnittene Zeilen, Originalbilder bleiben unverändert.

### P2 – KI und Sprechertexte
- [ ] Spiel-/Quellenadapter und Sponsor-Stammdaten/Tagesauswahl.
- [ ] Geschützte KI-Funktion und kostenbegrenzte Jobs.
- [ ] Ganze Abläufe und gezielte Abschnitte generieren, manuell ändern und freigeben.
- [ ] PDF-/Word-Export mit Quellenstand und offenen Punkten.
- [ ] Eigenen Sprecherzugang ohne Trainer-/Admin-Ersatzrechte.

Abnahme: Beispielablauf ohne Rabenstein-/Uhrzeit-/Wochentagsreste;
kein erfundener Gegner, Spielstand, Sponsor oder Schiedsrichter;
eigene Änderungen bleiben bei Regenerierung erhalten.

### P3 – Sprecherbedienung und Audio
- [ ] Textkarten, Reihenfolge, manuelle Phasen, Großansicht.
- [ ] Private Audiodateien/Bibliothek; Decks A/B und Jingle-Bus.
- [ ] Crossfader, Ducking und ALLES STOPP; Fehler-/Offline-Anzeige.
- [ ] Vorgefertigte Tor-/Wechsel-/Sonderdurchsagen aus bestätigten Angaben.
- [ ] Praktischer Test am Sprecherplatz mit angeschlossener Audioanlage.

Abnahme: Keine unbeabsichtigte Wiedergabe; STOPP beendet alle Busse;
Sprechen senkt Musik und stellt den Pegel wieder her;
weiterer Text/Audioeinsatz bei tatsächlich geladenem Offline-Paket.

### P4 – Kanäle und Veröffentlichung
- [ ] Anbieteranforderungen/Kontotypen überprüfen und Verbindung implementieren.
- [ ] Vorschau, Zielauswahl, Freigabe, geplante Aufträge und Statusanzeige.
- [ ] Erfolgs-/Fehler-/Timeout-/Tokenwiderruf-/Doppelversandtests.
- [ ] Verbindung mit eigenen Testkanälen und ausdrücklich gewählten Testbeiträgen prüfen.

Abnahme: Kein Post ohne passende Rechte und bestätigte Revision;
Retry erzeugt keinen Doppelpost; angezeigte Erfolgsmeldung hat eine bestätigte Remote-ID.

### P5 – Live-Rollout
- [ ] Technische Tests, DB-/Storage-Policies und Nutzerrollen auf Staging prüfen.
- [ ] Integrationstest auf iPhone, iPad, Desktop und am Sprecherplatz.
- [ ] Test-/Live-Branches sauber abgleichen, ohne andere Arbeiten zu überschreiben.
- [ ] Neue Module separat freischaltbar, Datenmigrationen geprüft und Rollback vorbereitet.
- [ ] Live-Schlüssel/Kanalverbindungen getrennt von Test prüfen.

## Noch bereitzustellende Eingaben

- Fertige Suno-Musik/Jingles als Dateien, mit Namen und gewünschter Funktion.
- Aktuelle Vereins-Sponsorentexte; Tagesrollen/Anwesenheit vor jedem Spiel bestätigen.
- Bestätigte Vereins-/Mannschaftszuordnung für Kampfmannschaft und Reserve.
- Sichere KI-Schlüssel-/Projektkonfiguration, Zugriff und Budget für Test/Live.
- Später: Facebook-/Instagram-Zielkonten und autorisierte Kontoverknüpfung.
- Medien- und Sprecherpersonen mit zugewiesenem Verein/Teamscope.

Die vorhandene PDF ist die Ablaufvorlage, keine Quelle für heutige Ergebnisse oder heutige Sponsorenzusagen.
Die bestehenden UI-Bilder sind Designentwürfe und kein Nachweis funktionierender Module.
