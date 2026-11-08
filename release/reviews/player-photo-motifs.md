# Spieler-Fotoserie: Prüfstand 2026-11-08

Migration `supabase/migrations/20261108145900_player_photo_motifs.sql`, Git-Blob `adcc4b71c0c0c6d4a835cc44d14105310f75eb14`.

Nur auf TEST (`spielzeitapp-staging`) angewandt. LIVE wurde ausschließlich lesend bezüglich Teamzuordnung und Berechtigungshelfern geprüft. Keine LIVE-Ausführung und keine Aufnahme in die LIVE-Freigabeliste.

`supabase/tests/player_photo_motifs.sql` wurde als Transaktion mit synthetischem Spieler und anschließendem ROLLBACK ausgeführt. Die tatsächliche Rolle `authenticated` und eingeschaltete RLS wurden verwendet, einschließlich eines berechtigten Trainers ohne Plattformadminrechte. Geprüft: unberechtigter Nutzer, erlaubtes Speichern/Lesen, getrennte Ablage, falsche Mannschaft, ungültige Gestaltung, doppelte Anlage, veraltete Revision, archivierte Saison, kein anonymes Leserecht und unverändertes Profilfoto. Der bestehende Storage-Pfadhelfer akzeptiert den getrennten Dateinamen für den berechtigten Trainer. Kein Hinweis auf die neue Tabelle im anschließenden Security-Advisor-Bericht.

React-Verhaltenstests prüfen die vollständige Serie Profil → Spieltag → Jubel → nächster Spieler, Wiederholen, Fehlererhalt, Überspringen, Abschluss sowie nachträgliche Helligkeit/Freistellung ohne Profil-RPC. Handyfoto-Import erhält das volle Seitenverhältnis. Vite-Build und regulärer Typecheck bestanden. Der umfassende Repository-Typecheck enthält bestehende Fehler; in den neuen Manager-/Motivmodulen wurden keine Fehler gemeldet.

Offen: physischer iPhone-Kameratest, echter Storage-Upload mit angemeldetem Trainer und resultierende Post-Auswahl auf der bereitgestellten TEST-App. Live-Segmentierung ist optional; die Fotoserie benötigt sie nicht. Zwei-Geräte-Kopplung ist nicht enthalten.
