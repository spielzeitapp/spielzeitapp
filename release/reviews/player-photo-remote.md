# Fotobox-Fernsteuerung – Prüfung 2026-11-08

Nur TEST. Keine LIVE-Ausführung oder Eintragung in die LIVE-Freigabeliste.

Migrationen:
- `20261108163535_player_photo_remote.sql`, Blob `bcaedc5409a0b5faa3f215fe561d6f8e1fb065cd`.
- `20261108165520_player_photo_remote_insert_columns.sql`, Blob `a2416bc5e026e503260e4d24e3f5a929f039c8cb`.

Die Abhängigkeiten can_manage_team_staff und pg_cron wurden auf LIVE ausschließlich lesend geprüft. Beide Migrationen sind auf spielzeitapp-staging angewandt. Neue Tabelle mit RLS und Spaltenrechten: Erstellen nur über Mannschafts-ID, Eigentümer/Kopplungs-ID/Laufzeit durch DB; Lesen/Steuern nur Eigentümer mit Managerrechten. Standardlaufzeit zwei Stunden. Der Cronjob entfernt abgelaufene Sitzungen samt Vorschaudaten alle zehn Minuten. Beenden löscht die Sitzung; Kamera-Abschluss gibt Kamera/Entwurf frei.

`supabase/tests/player_photo_remote.sql`: synthetische Sitzung, bestehender Nicht-Admin-Tester temporär als Trainer, tatsächliche authenticated-Rolle mit RLS. Erlaubte Erstellung/Lesen, parallele Kamerakopplung, veraltete Befehls-ID, verbotener Eigentümer-/Ablaufwechsel, verbotene Client-Laufzeit bei Anlage, fremdes Konto, abgelaufene Sitzung, fehlendes anonymes Leserecht und aktiver Ablaufjob geprüft; danach ROLLBACK. Keine neue Tabellenwarnung im Security Advisor. Die tatsächliche Cron-Ausführung wurde nicht zeitlich abgewartet.

`node scripts/player-photo-remote-test.mjs`: Auslösen einmalig trotz wiederholtem Poll, alter Entwurf verworfen, Kontextwechsel, Online-Timeout, Kamera-Freigabe, gleicher Origin im QR-Link, iPad fordert keine Kamera an, Auslösen gegen Doppeltippen gesperrt, Übernehmen erst nach empfangener Vorschau und mit exakter Entwurfs-ID. Bestehende Fotobox-, Fotoeditor- und Vereinsvorlagentests bestehen. Vite-Build und regulärer Typecheck bestehen. Der vollständige Repository-Typecheck enthält bestehende Fehler; keine Meldung in den neuen Fernsteuerungsmodulen.

Grenzen: Zwei echte angemeldete Geräte, physische Kamera, Netzunterbrechung im Mobilfunk und echte Fotoübernahme sind noch auf TEST zu prüfen. Vorschau wird nach der Aufnahme übertragen, kein kontinuierlicher Videostream. Beide Geräte benötigen dasselbe Managerkonto und eine aktive Internetverbindung; das Original verbleibt bis zur bewussten Übernahme auf dem Kamera-Handy. Keine zusätzlichen Pakete. Die Übertragung kleiner Vorschaubilder erfolgt über private, kurzlebige DB-Sitzungen; keine öffentliche Fotoablage vor Übernahme.
