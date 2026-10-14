# Musik- und Sprecherstudio: nächste Testversion

Diese Änderung baut auf der noch nicht ausgelieferten Trennung von Musikstudio und Sprecherstudio auf. Veröffentlichung gesammelt auf develop, Live unverändert.

## Bedienung
- Weiß/Schwarz oben auswählen. Die Auswahl bleibt auf diesem Gerät pro Konto gespeichert. Auch die Offline-Seite übernimmt sie.
- Player A und B haben Tempo −/+, Prozentanzeige und Rücksetzen auf 100 %. Bereich 80–120 %, Schritte 1 %. Das Tempo wird unabhängig pro Player geändert; Jingles laufen im normalen Tempo.
- Fade-out senkt die gesamte Audioausgabe über drei Sekunden und stoppt anschließend Player und Jingle. Ein neuer Wiedergabestart hebt eine alte Ausblendung auf.
- Alles STOPP stoppt sofort und verwirft eine noch laufende Ausblendung und Playlist-Fortsetzung.
- Jingle-Karten zeigen Titel und Dateiname. Start und Stopp sind eigene Tasten. Ein laufender Jingle wird grün markiert, zeigt LÄUFT, Laufzeit und Fortschritt. Jingle-Stopp lässt Musik auf A/B weiterlaufen.
- Jingle-Name und Datei sind unter Zuordnung ändern erreichbar.
- Im Offline-Player gibt es Schwarz/Weiß, Tempo für den einzelnen Musikplayer, Fade-out und eigene Start-/Stopptasten für Jingles.

## Prüfung
- Produktions-Build erfolgreich.
- Tempo-Grenzen/Rundung, Fade-Ende, Abbruch und alte Timer getestet.
- Offline-Simulation: Wiederherstellung, nächster Titel, sofortiger Stopp, Tempo, Theme-Speicherung, Jingle-Stopp unabhängig von Musik und Fade-Abbruch geprüft.
- Prüfung für einen stabilen Audioplayer beim Moduswechsel besteht weiter.
- Tatsächliche hörbare Wiedergabe der neuen Steuerungen auf dem Sprecher-PC nach Veröffentlichung prüfen.

## Veröffentlichung
Als ein Commit zusammenfassen, damit der Test-Deploy nur einmal angestoßen wird. Vercel meldete zuletzt ein erreichtes Build-Limit. Keine Änderungen an Live, Tarif oder Kontoverknüpfungen.
