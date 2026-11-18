# Vereinsshop mit Vorauskassa und Sammelbestellungen

Der bisherige USC-Fanshop war ein unverbindlicher Beispielkatalog. In TEST verwendet er nun dieselbe echte Shopverwaltung wie der Einstieg „Vereinsshop“ im Vereinsmarkt. LIVE behält den bisherigen Vorschau-Warenkorb. Es werden keine Beispielprodukte, Kontodaten, Berechtigungen oder Bestellungen angelegt.

## Einrichtung und Bedienung

Vereinsadmin: Vereinsshop → Verwaltung → Shop einrichten. Kontoinhaber, IBAN, Händlerkonto und optional Shopverantwortlichen über die exakte E-Mail eines bestehenden SpielzeitApp-Kontos zuordnen. Sortiment mit Endpreisen, Größen, optionalem Produktbild und Aufdruckmöglichkeit hinzufügen. Der Endpreis enthält gegebenenfalls den angebotenen Aufdruck. Shop aktivieren und Bestellrunde mit Stichtag eröffnen. Jede neue Runde übernimmt Kontodaten und Händlerzuordnung als unveränderlichen Schnappschuss.

Eltern erfassen eine zahlungspflichtige Bestellung, erhalten eine eindeutige Referenz und überweisen selbst an den Verein. Der Kassier prüft das Bankkonto und bestätigt die Zahlung. Nach dem Stichtag gibt die Verwaltung ausschließlich bezahlte Bestellungen frei. Unbezahlte Bestellungen werden nicht automatisch in die nächste Runde übernommen; bereits überwiesene, nicht zugeordnete Zahlungen sind mit dem Verein zu klären.

Der Händler öffnet denselben Vereinsshop und den nur für ihn sichtbaren Bereich Händlerportal. Er erhält ausschließlich seine freigegebenen Bestellungen mit aggregierten Größenmengen sowie einer CSV mit Familien- und Aufdruckzuordnung. Er bestätigt die vollständige Lieferbarkeit, hinterlegt einen HTTPS-Link zu einer extern geschützten Sammelrechnung und setzt den Auftrag auf in Bearbeitung bzw. abholbereit. Die Verwaltung bestätigt die tatsächliche Banküberweisung und die Ausgabe pro Familie. Abschluss ist erst möglich, wenn alle freigegebenen Bestellungen ausgegeben sind.

## Sicherheit und Datenbank

Migration: `20261116190514_club_shop_prepaid_rounds.sql`, Git-Blob `355cf0402cbeece7aa83b06ba9fc7c34da7af0fd`, ausschließlich TEST ausgeführt. Keine LIVE-Freigabe in `release/live-plan.json` eingetragen.

Alle fünf Tabellen haben RLS und keine direkten Rechte für anon/authenticated. Das Advisory „RLS enabled without policies“ beschreibt hier den absichtlichen vollständigen Direktzugriffsverschluss; ein authentifizierter Direktzugriff wird im SQL-Test abgelehnt. Ein öffentlicher Invoker-RPC delegiert an eine private, eng begrenzte Definer-Funktion mit expliziter Prüfung von auth.uid(), operable club, Vereinsmitgliedschaft, Vereinsadmin, dediziertem Shopmanager bzw. Händlerzuordnung. Keine user_metadata-Auswertung. Der Händler erhält keine unbezahlten/unfreigegebenen Elternbestellungen. Eltern sehen ausschließlich eigene Bestellungen.

Produktpreise und Größen werden serverseitig geprüft und bei Bestellung gespeichert. Ein erwarteter Gesamtpreis verhindert unbemerkte Preisänderungen. Idempotente Bestell-UUID verhindert Doppelbestellungen nach Netzfehlern. Zahlung/Freigabe verwenden dieselbe Sperrreihenfolge (Runde, Bestellung); Rundenstatusänderungen verlangen die erwartete Versionsnummer. Browseränderungen von Preisen, bezahlten Flags oder Freigaben haben keine direkte Schreibschnittstelle. CSV-Zellen sind gegen Formelauswertung abgesichert.

## Nachweise

- `scripts/sql/club-shop-test.sql`: isolierte synthetische Nutzer, Vereine und Bestellungen, vollständiger Rollback. Erfolgreich auf TEST mit Rolle authenticated/anon ausgeführt. Prüft Elternbestellung, falschen Preis, fehlenden Preis, ungültige Menge/Größe, fremden Verein, fremde Elternbestellungen, Händlerzugriff vor Freigabe, Selbstbestätigung von Zahlungen, unberechtigte Konfiguration, Direktzugriff auf Tabellen, frühe Freigabe, idempotente Wiederholung, veraltete/fehlende Version, vollständigen Händler-/Rechnungs-/Ausgabeablauf und Ausschluss unbezahlter Bestellungen.
- `npm run test:club-shop`: UI-Interaktionen mit kontrollierten RPC-Fixtures; erforderliche Größe, Personalisierung, Checkout-Payload, Rollennavigation, gesperrte Freigabe und CSV-Schutz.
- `node scripts/usc-fanshop-test.mjs`: bisheriger Vorschau-Warenkorb bleibt funktionsfähig.
- `npm run build`: erfolgreich (2m12s); fokussierte TypeScript-Prüfung der neuen Shopansicht mit `vite/client`: ohne Fehler.
- Supabase Security Advisors nach der Änderung ausgeführt; keine neue offene Tabellenberechtigung. Absichtliche Default-Deny-Advisories siehe oben.
- Gleichzeitige unabhängige Datenbanksitzungen und Browserdarstellung auf realem iPhone wurden noch nicht geprüft. Keine LIVE-SQL-Freigabe behauptet.

## Grenzen der ersten Version

Manuelle Überweisungen und manuelle Zahlungseingangsbestätigung; keine Bankanbindung, Onlinezahlung oder automatische Rückerstattung. Monatsrunden werden bewusst manuell eröffnet/freigegeben. Noch keine automatischen Shop-Pushnachrichten. Rechnungen werden per geschütztem HTTPS-Link hinterlegt, nicht als Datei in SpielzeitApp hochgeladen. Bei Nichtlieferbarkeit/Preisänderung ist zunächst Rücksprache außerhalb dieses Workflows erforderlich; keine stille Ersatzlieferung. Für einen öffentlichen Verkaufsstart müssen Sortiment, Preise, Kontodaten und die konkreten Verkaufs-/Stornobedingungen des Vereins festgelegt sein.

## Marktgestaltung auf TEST (18.11.2026)

Eingebetteter Shop verwendet den bestehenden Vereinsmarkt-Kopf, dessen Theme und Navigation. Runde Artikelkarten, weinrote Akzente, gemeinsame Bestellrunde und Vorauskassa-Hinweis. Artikelsuche nach Name; keine Änderung an Zahlungs-/Freigaberechten, Sortiment oder echten Kontodaten. Ohne hinterlegte Produkte wird kein Beispielsortiment zum Verkauf gestellt. Lagerware und Sammelbestellware sind weiterhin nicht getrennt implementiert.

## JAKO-Probeartikel (18.11.2026)

Auf TEST zeigt der noch leere Shop zwei reine Vorschauvarianten (Kinder/Erwachsene) des vom Nutzer verlinkten JAKO Ziptop Dynamic, Artikel 8670 / Farbe 114. Quelle und Originalproduktfoto: https://www.jako.com/de-de/ziptop-dynamic-p13949/?color=114 bzw. https://cdn.jako.com/userdata/dcshop/images/normal/8670_114.jpg. Beispielpreise 44,99 / 49,99 EUR werden ausdrücklich nicht als zugesagte Vereins-/Händlerpreise dargestellt. Keine Behauptung über inkludierte Veredelung oder Verfügbarkeit beim Verein. Produktbild bleibt unverändert.

Die Vorschau ist auf Staging und leeres aktives Sortiment begrenzt, auch ohne Login sichtbar. Probe-Warenkorb ausschließlich im Komponentenstate, ohne RPC, Kontoangaben, Freigabe oder Bestellung. Sobald reale aktive Produkte vorhanden sind, verschwindet das Beispielsortiment. Tests: `node scripts/shop-trial-test.mjs` (Größen, Kinder-/Erwachsenenpreise, Aufdruckeingabe, Summen, kein Zahlungs-/Bestellabschluss) und bestehender Shoptest.
