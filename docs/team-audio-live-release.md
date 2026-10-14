# Teammusik und Spieltagsansagen – Live-Release 14.10.2026

Gezieltes Paket auf Live/main, Basis e80ba5f493f89c6c54dcecb872f2f1829a480e56. Andere develop-Änderungen, Live-Konfiguration und Workflows bleiben erhalten.

Enthalten: getrennte Musik-/Ansagenwege, A/B-Player, Crossfade, ducking, Fade-out 3 s, Tempo 80–120 %, Tag/Nacht, sechs farbige Jingles mit Start/Stopp, kompakte Playlist-Ansicht, Großansicht, Shuffle, lokale/offline Speicherung und private Vereinsablage; Ansagenvorlagen, Spielinfos und accountbezogene Entwürfe.

Die KI-Funktion ist auf Live nicht bereitgestellt und die KI-Taste deaktiviert. Automatische Freigabeprüfung hat das Deployment wegen fehlender ausdrücklicher Freigabe zur Übermittlung von Live-Spiel-/Mannschafts-/Ansagentexten an OpenAI abgelehnt. Nach Freigabe separater Schritt: Edge-Funktion mit Live-CORS und verify_jwt=true bereitstellen, health prüfen, KI-Taste wieder aktivieren.

Live-DB: drei additive Migrationen für manager_communication_drafts, communication_generation_limits und speaker-audio-Storage. Zugriff beschränkt auf Entwurfseigentümer mit Staff-/Vereinsrechten und berechtigte Musiknutzer; Ablage privat, 25 MB, Audio und Playlist-JSON. Prüfung per Transaktion mit Rollback: berechtigter Staff kann Entwurf anlegen/aktualisieren (Revision 2), Außenstehender abgewiesen. Service-only KI-Limit RPC für anon/authenticated nicht ausführbar. Advisor INFO für generation_limits ohne Policies ist absichtlich server-only; Rollenprüfungen begrenzen Draft-Zugriff trotz generischem Hinweis zu anonymen Auth-Nutzern.

Validierung: Produktionsbuild und 23 relevante Tests erfolgreich, git diff --check. Audioausgabe am physischen PC muss vom Nutzer getestet werden.

Test und Live sind unterschiedliche Browser-Origin- und Datenbankbereiche: lokale Musik, Playlists und Vorbereitungen von app.spielzeitapp.at erscheinen nicht automatisch auf spielzeitapp.at. In Live Dateien/Playlists neu laden und Offline vorbereiten. Es wurden keine Testdaten nach Live kopiert.
