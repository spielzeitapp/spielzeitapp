# Vereinsinterne Tauschbörse – TEST

Entry: `/app/usc-rohrbach?tab=verein&section=tauschboerse`.
SpielzeitApp entry: **Mehr → Tauschbörse**, `/app/tauschboerse`. Uses the selected team's club (or configured partner-club exchange) and offers a club selector when multiple clubs are available. Both surfaces use identical listings and private chats. New notification links preserve the actual club and thread on the authenticated main-app route. Existing USC notification links remain valid.

Parent context refinement: only active parent memberships contribute clubs in parent mode; favourite/fan-only and archived team entries do not create a club selector. One club opens directly with a small club label; two actual parent clubs offer a compact switcher. Trainer/admin mode uses active parent/staff/admin assignments. The caller's team label is prefilled in new listings, and a single assigned team is shown without an unnecessary team selector. The unrelated event-creation FAB is hidden on the exchange route. Glass surfaces, club gradients, compact segmented tabs and editor controls follow the app's shared visual tokens. Renderer tests cover one parent club plus a favourite, two parent clubs, switching, and saved team prefill; native iOS visual/camera verification remains a manual check.
UI is staging-only. The push API additionally rejects every non-staging database URL.

## Behavior

- All eligible club members see listings across teams, independently of team favourites.
- Active parent/trainer/coach/fan memberships or club/platform administration permit access. Player-only accounts and favourites alone do not.
- Partner youth teams are configured separately in `exchange_partner_teams`; no club/user IDs are embedded in migrations. TEST has the existing SPG Rohrbach U12/U13 assigned to USC.
- Up to five camera/gallery images, locally resized to JPEG with location/EXIF metadata removed. Private bucket, 15-minute signed URLs, at least one photo to publish.
- Only a first-name snapshot is published. No broad profile reads or automatic contact sharing.
- One thread per listing/requester. Only participants can read messages. Owners can reserve, mark given away, edit or delete their listing. Revisions reject stale saves.
- Contact sharing sends only the text explicitly entered by the user into the current private chat. Blocking stops messages in both directions.
- A message transaction creates an in-app notification plus a durable push queue entry. The API accepts no recipient/content/link from the client. It verifies the sender, claims their pending entries, and sends a generic banner through existing active subscriptions.
- `STAGING_DISABLE_OUTBOUND=true` is honored. Failed push delivery remains pending and is retried on the sender's next visit; at most five attempts. This version has no autonomous background retry worker. No subscription means only the in-app notification.

## Evidence and limits

- Publication UX: separate, unchecked-per-editor publication confirmation in addition to the adult acknowledgement; the save handler checks both before draft creation or photo upload. Publish button states clearly distinguish new publication from edits. Inline exchange privacy notes explain visibility, voluntary contact sharing, chat scope and deletion. Photos warn against persons/children/documents. The team reference is optional; disabling it writes an empty team label instead of retaining hidden team data in the listing. Renderer regression verifies missing-confirmation blocks all writes/uploads, optional-team omission, and reset on the next editor opening. This is a UI publication acknowledgement, not a stored legal-consent audit record or legal review of a complete privacy policy.

- Editor visual refinement: rectangular 10px-radius tiles with a checkmark on the active option; categories/condition in two columns, sizes in five, offer tiles with icons in three. The editor is a flex column with a separately scrolling body and an opaque footer outside that scroll region. Save remains a native submit button of the same form and retains its busy/disabled state. Existing save/upload/chat/catalogue/context regressions pass with the new structure. Native iOS visual verification remains a manual check.

- Listing editor now uses visible, accessible selection buttons for category, clothing/shoe size, condition, offer and multiple assigned teams. The single own team stays read-only. Custom sizes remain possible through a text field. Switching between clothing and shoes clears an incompatible size. Renderer regression verifies no native selects remain in the editor, size-system switching, offer-dependent price field, and persistence of selected category/size/condition through the photo-upload save flow.

- Shop-style catalogue update: larger cards/typography, text search, active removable filter chips and a modal filter sheet for category, size, offer and team. Clothing/shoe sizes are suggested even before a club has listings; existing custom sizes remain usable. Draft filter changes apply only with the result-count button. Newest/price sorting keeps swaps without a price last. No example products are inserted into the club database. `scripts/club-exchange-catalog-test.mjs` covers combinations, normalized size matching, search, own listings, non-mutating sorting, shoe sizing, draft/apply/reset/close. Existing exchange UI and parent-club context regression tests also pass.

- Follow-up regression: the original composite PK on `exchange_partner_teams(club_id,team_id)` caused PostgREST to infer a new many-to-many `teams → clubs` relation. Existing unqualified embeds failed with HTTP 300/PGRST201, preventing session teams from loading. This was reproduced through the actual TEST REST API. Migration `20261113102805_exchange_partner_relationship_fix.sql` replaces the PK with a generated `id`, retains uniqueness of the club/team pair, and reloads the schema cache. No memberships or other user data are removed. `scripts/club-exchange-relations-test.mjs` checks real PostgREST embeddings, alongside the isolated schema/RLS tests. The original mocks did not cover automatic API relationship inference.

- Vite production build, the configured `npm run typecheck`, and a dedicated TypeScript check for the exchange UI pass. The full-project TypeScript check reports errors in existing legacy/live/training modules outside this change; it is not a clean project-wide check. No diagnostics reference the new exchange files or modified USC app. The existing USC fanshop regression test also passes after incorporating its concurrent TEST update.
- `scripts/club-exchange-sql-test.mjs`: PGlite replays all exchange migrations with Supabase-style default grants, then runs synthetic transactions as the authenticated role. Covers outsider/player rejection, partner access, owner-only changes, no anonymous/TRUNCATE/immutable-column grants, path/storage RLS, third-party chat rejection, forged sender/owner, duplicate thread, targeted notifications with club/thread deep links, blocking, stale revisions and deletion. Fixtures roll back.
- `scripts/club-exchange-main-app-test.mjs`: verifies the main-app entry, shared SPG/USC scope, switching clubs, notification club taking precedence over the selected team, and authorization before team data is requested.
- `scripts/club-exchange-ui-test.mjs`: React renderer exercises listing creation, photo input/upload path, private inquiry/reply, voluntary contact sharing, block/unblock and reserve. DOM/canvas/Supabase are mocked; this does not prove native camera or visual layout.
- `scripts/club-exchange-push-test.mjs`: mocked delivery verifies method/auth, strict TEST target, outbound-disable, server-owned recipients/content, job claim and completed-job dedupe. No real push is sent. The endpoint uses a self-contained CommonJS entry to avoid Vercel runtime resolution of extensionless TypeScript imports.
- TEST database inspection confirms all six tables use RLS, the bucket is private, actual storage policies do not grant unrelated buckets access, and explicit grants are installed. Security advisor's no-policy notice for `exchange_push_queue` is intentional: all client grants revoked, service-role only.
- Remote transaction test through MCP expired before confirmation. No result from that test is claimed. Local PostgreSQL-compatible tests passed. A real authenticated two-device camera/upload/chat/push check remains open; local Chromium could not start because socket creation was denied.
- Existing LIVE dependency columns were inspected read-only. No LIVE data/schema/source deployment was changed. No hashes were added to `release/live-plan.json`; this is not an approval for LIVE publication.

## Reproduce

Run `node scripts/club-exchange-ui-test.mjs` and `node scripts/club-exchange-push-test.mjs` with repository dependencies installed.
For the isolated SQL test install `@electric-sql/pglite@0.3.14` in a temporary prefix and set `EXCHANGE_PGLITE_PATH` to its package directory before running `node scripts/club-exchange-sql-test.mjs`.

The first two migrations were applied to TEST, followed by a TEST-only policy correction for owner cleanup and the explicit privilege migration. The checked-in second migration includes that cleanup correction so a fresh replay produces the same final schema. No already-LIVE migration was modified.

## Public club marketplace (TEST only, 2026-11-14)

- `/marktplatz/:clubId` has standalone guest navigation and safe public listing/photo API.
- Existing ads default `is_public=false`. Explicit editor opt-in and publication acknowledgment required; server stamps confirmation. Withdrawn/unavailable/deleted listings disappear from guest API, including photo downloads.
- Guest JSON excludes owner IDs/names, team labels and private storage paths. Private DB/storage RLS remains unchanged; server projects approved fields.
- Browse/search/filter without login; enquiries and publishing currently require existing club-associated accounts. Self-registration alone does not establish membership. Shop is a clearly marked placeholder.
- Verification: public API security tests, public guest navigation/login-return tests, existing exchange interaction/catalog tests, isolated SQL/RLS migration replay, scoped TypeScript and Vite production build. UI tests use renderer mocks; no native mobile or actual push delivery test.
- Test URL: `https://app.spielzeitapp.at/marktplatz/3db6fce2-a4c1-44a5-a333-19d1d4d62e6a`.
- No genuine or demo ads are automatically published. LIVE migration/release not included.

### Marketplace home-screen installation
- Dedicated manifest `/api/exchange/public?manifest=1&club=UUID`, separate per-club ID and public `start_url=/marktplatz/UUID`.
- Early HTML metadata and React ManifestSync select the same marketplace manifest, new approved shield/jersey/exchange-arrow icon and name Vereinsmarkt.
- Old iOS bookmarks may retain the previous `/app` start URL. Remove the old home-screen shortcut and re-add from the public club URL in Safari.
- `scripts/club-exchange-manifest-test.mjs` checks the public start, metadata before React, image sizes and unchanged default/demo/USC entries.

### iPhone installation metadata follow-up
USC marketplace now serves built `markt.html` through the first exact club-route rewrite, with literal Vereinsmarkt title, apple-mobile-web-app-title, icon and static manifest. This removes dependence on JavaScript switching the initial trainer manifest. Static manifest retains the public club start URL. The generated entry is checked by club-exchange-static-install-test.mjs; physical iOS installation still needs device confirmation.

### Vereinsmarkt auth presentation
Own shield/jersey wordmark on login, registration and password reset. Original password auth and Turnstile remain intact; player login and demo controls are hidden only for marketplace context. Club identity and safe listing return path are carried across sign-in/register/forgot links, with market-back link. Password recovery callback carries market context; generic/USC flows retain their behavior. Profile hides duplicate header sign-in. Tests exercise original sign-in, selected-listing return, registration/reset links, generic/USC behavior and hostile return targets. No real account, password reset email or push was sent by tests.

### Standalone signed-in marketplace
Authentication returns to `/marktplatz/:club?view=member` or `view=profil`. Legacy marketplace `next=/app/tauschboerse` and `/app/profile` values normalize to the public club route, preserving selected listing/thread/mode. Only a strict local UUID club route is accepted by auth redirects. Explicit market login remains in the market instead of entering the app intro. Existing normal app and USC auth flows remain covered by regression tests.
Signed-in private content reuses ClubExchangePage in embedded mode inside public navigation, preserving membership/RLS gates and pinning club to route. It does not mount InternalLayout or its global push onboarding. Profile reflects session; own listings, requests, create and logout stay in the market shell. No new membership is granted. Tests cover logged-in/guest navigation, real mocked password sign-in return, legacy targets, existing sessions, hostile redirect input, embedded club pinning and denied team queries. No actual device push/email test performed.

### Header switches between app and market
TEST app header adds a circular market-logo link for authenticated, non-demo app users. Existing club-context resolver selects the active assigned club (including SPG-to-USC partner mapping) before navigating to its public market. Public market shows an app-logo circle only when signed in; its safe local return URL persists across public tabs, listing views and auth/member links. Default for direct market entrants is app home. React Router links reuse the existing session. No new permissions or database grants. Tests cover original app return including team query/hash, guest hiding, authenticated icon, market club resolution and rejection of external/traversal return URLs.

## TEST 15.11.2026: Anmeldung und private Merkliste
- Normale Anmeldung/Registrierung kehrt zur öffentlichen Markt-Startseite zurück. Explizite Inserat-, Erstellen-, Nachrichten- und Merkliste-Ziele bleiben erhalten.
- Anmeldetext erklärt gemeinsames Vereinsmarkt-/SpielzeitApp-Konto; Registrierung erfordert keine App-Installation und vergibt keine Vereinsmitgliedschaft.
- Herz auf öffentlichen und internen Inseraten; Profil → Meine Merkliste zeigt im aktuellen Verein noch verfügbare, weiterhin zugängliche Angebote. Speicherung pro Konto, keine öffentliche Favoritenzahl.
- Neue Migration `20261115090931_exchange_saved_listings.sql`: nur eigene Einträge lesen/entfernen; Einfügen erfordert aktive öffentliche Freigabe oder Vereinsberechtigung. Kein Update, keine Rechteerweiterung auf Inserate.
- Isolierter PGlite-Test: echte authenticated/anon-Rollen, Nutzertrennung, Identitätsspoofing, ungültige ID, wiederholtes/gleichzeitig angestoßenes Speichern, Sperre nach Rücknahme/Vergeben, Löschen/Cascade. Keine synthetischen Nutzer in TEST-Datenbank.
- UI-Mocks prüfen Speichern, erneutes Laden, Kontowechsel, Fehler und Entfernen; Auth-Kontinuität, öffentlicher Katalog/API, private Anfragen/Fotos bleiben getestet. Physische iPhone-Kamera und echte Pushzustellung sind damit nicht geprüft.
- Keine LIVE-Freigabe/Manifest-Hashes ergänzt; LIVE-Datenbank und main bleiben unverändert.

## TEST 15.11.2026: Splash, eckige Filter, Schuhe und Zubehör
- Markt-HTML enthält sofort den Logo-Splash; identischer React-Splash für Route und initiales Laden von Verein/Katalog/Anmeldung. Kein Platzhalter-Vereinsheader oder Footer während des Ladens; keine künstliche Mindestdauer. Bei API-Timeout nach 12 Sekunden erscheint eine Fehlermeldung mit Wiederholen.
- Filterauswahl, Größen, Angebotswahl und Abschlussbutton mit 12px Ecken. Artikel/Unterarten als gut antippbare Felder.
- Schuhgruppe: Fußballschuhe, Hallenschuhe, Laufschuhe (gemeinsames Schuhgrößensystem). Startseiten-Symbol kombiniert Fußballschuh und Laufschuh.
- Zubehör: Schienbeinschoner, Torwarthandschuhe, Sporttaschen, Rucksäcke, Bälle, Trinkflaschen, Trainingszubehör. Unter Trainingszubehör fallen etwa Hütchen, Koordinationsleitern und Leibchen. Bälle: Größen 3/4/5; Handschuhe: 4–12; übriges Zubehör mit Einheitsgröße und freier Eingabe.
- Migration `20261115093231_exchange_article_types.sql` erweitert ausschließlich die Kategorien-Prüfung. Bestehende Kategorien und Daten bleiben erhalten; Rechte/RLS unverändert. Alte „Schuhe“ erscheinen im Schuhgruppenfilter, alte „Sonstiges“ auch bei Zubehör. Keine automatische Unterkategorisierung vorhandener Inserate.
- Isolierte SQL-Prüfung unter authentifizierten Rollen: alte/neue Kategorien speicherbar, unbekannte Kategorie und Nutzer ohne Verein abgewiesen; vorhandene RLS-/Chat-/Stale-Revision-Prüfungen erneut erfolgreich. UI-Tests: verzögerte Datenantwort zeigt ausschließlich Splash, anschließend echte Vereinsansicht; Unterarten, Schuhgrößen, Zubehörgrößen, Filterergebnisse, Größenwechsel und Erstellung geprüft.
- Produktionsbuild und scoped TypeScript-Prüfung erfolgreich. Lokale Chromium-Screenshotprüfung war durch die Laufzeitumgebung blockiert; keine physische iOS-Prüfung behauptet. Keine LIVE-Freigabe ergänzt.

## TEST 15.11.2026: Tag-/Nachtmodus
- Sonne-/Mond-Schalter im öffentlichen Header und auf Markt-Anmeldeseiten. Standard bleibt Nachtmodus; Auswahl wird unter `spielzeit.vereinsmarkt.appearance.v1` auf dem Gerät gespeichert. Separate Präferenz, keine Kontodaten und keine Änderung der SpielzeitApp-Darstellung.
- Heller Modus für Katalog, Detail/Merkliste, Profil, Navigation, native Filter-/Inseratdialoge, Chat und Login/Registrierung/Passwort vergessen. Rote Akzente und kontrastreiche Primärbuttons bleiben bestehen. Native Dialoge bleiben über die Dokument-Markierung korrekt gestaltet.
- HTML-Bootstrap liest die gespeicherte Einstellung vor dem ersten Splash. Route-Synchronisation entfernt Markt-Thema und stellt Browser-Farbe beim Wechsel zurück zur App wieder her. Ohne beschreibbaren Browser-Speicher funktioniert der Schalter für den Besuch weiter.
- `market-theme-test.mjs`: Umschalten, Speicherung, Wiederaufnahme beim Zurückkehren, Auth-Kontinuität, anderer Tab, gesperrter Speicher und Aufräumen der Dokument-/Browser-Farbe geprüft. Public-UI, Auth-Kontinuität, Editor und Installationsmetadaten erneut geprüft. Native iOS-Anzeige nicht physisch getestet.
- Kein SQL, keine LIVE-Veröffentlichung. Kleine Textkorrektur: ein Treffer heißt „1 Angebot“.

## TEST 15.11.2026: Vereinsmarkt-Navigation an LIVE angleichen
- LIVE `main`: BottomNav, useViewportRecovery, standaloneViewport und Layout gelesen. Viewport-Recovery ist bereits identisch; übernommen wird die begrenzte LIVE-Abstandsformel statt 10px plus vollem iOS-Safe-Area-Wert.
- Vereinsmarkt-Leiste bleibt im eigenen App-Rahmen unten verankert; im erkannten iOS-Vollbild nutzt der Rahmen explizit die korrigierte Bildschirmhöhe. Scroll-Endabstand orientiert sich an Leistenhöhe plus begrenztem Abstand, damit Footer/Links erreichbar bleiben.
- Regression: normale und veraltete Safe-Area-Werte (0/20/34/80/120), Vollbild-/Resume-/Tastatur-/Zoom-Policy. WebKit-Geräteprüfung hier nicht ausführbar (Browser-Binary fehlt); keine physische iPhone-Prüfung behauptet. LIVE und SpielzeitApp-Nav unverändert.

## TEST 15.11.2026: Nachrichten-Push und gemeinsame Badges
- Ursache am realen TEST-Schema bestätigt: Push-Versand fragte `notification_subscriptions/is_active` ab; tatsächliche Registrierung verwendet `push_subscriptions` ohne is_active. Ein Versandauftrag blieb pending, der Empfänger hatte ein registriertes Gerät und eine ungelesene Markt-Mitteilung. Keine Nachrichten-/Kontaktdaten oder Geräteschlüssel ausgelesen.
- Versand nutzt nun die vorhandene Gerätetabelle, entfernt 404/410-Endpunkte dort und liefert den serverseitig gezählten Gesamt-Unread im SW-kompatiblen Badge-Payload. Titel „Vereinsmarkt“, Nachrichtentext bleibt generisch. Authentifizierung, senderbezogene Queue, atomarer Claim, TEST-/Outbound-Sperren bleiben erhalten.
- Öffnen des angemeldeten Marktbereichs stößt einen erneuten Versuch eigener wartender Pushes an; Aufträge anderer Absender bleiben gesperrt. Keine echte Testnachricht im Auftrag erzeugt oder fremde Sitzung verwendet.
- Öffentliche Navigation zeigt Nachrichten-Badge für den aktuellen Verein. Interner Anfrage-Zähler wird auf sichtbare Vereins-Chats begrenzt. SpielzeitApp-Inbox/Glocke und OS-Badge verwenden weiterhin dieselben Notifications. Lesen meldet den aktualisierten Stand an alle eingebundenen Zähler.
- Da `notifications` in TEST nicht in der Realtime-Publikation liegt, aktualisiert der gemeinsame Unread-Hook zusätzlich alle 15 Sekunden im sichtbaren Fenster und bei Fokus/Rückkehr. Kontowechsel, Logout und verspätete Antworten dürfen keine fremden Zähler übernehmen.
- Prüfungen: bestehender Nachrichten-/Foto-/Blockierungs-Workflow; Push mit realitätsgetreuer Tabellensimulation, Auth/TEST-Sperre, Payload/Badge, Wiederholung ohne Doppelversand, temporärer Fehler, 410-Bereinigung; Markt-/App-Zähler, Vereinsfilter, Polling ohne Realtime, Gelesen-Signal, Kontowechsel/Logout. Keine tatsächliche Pushzustellung am iPhone behauptet; neuer Versandtest nach Deployment erforderlich. Keine SQL-/LIVE-Änderung.

## TEST 15.11.2026: Äußeres Scrollen des Vereinsmarkts sperren
- Folge-Screenshots zeigten gemeinsam verschobenen Header und Navi. Die globale html/body-Regel erlaubte weiterhin Dokument-Scroll/Bounce; allein ein kleinerer Navi-Abstand behebt dies nicht.
- Markt-Routen markieren das Dokument vor dem ersten Splash und über den Router-Lebenszyklus. Nur dort: body festsetzen, html/body/root-Überlauf sperren, festen Markt-Rahmen am gemessenen sichtbaren Viewport ausrichten. Ausschließlich main bleibt vertikal scrollbar; Pinch-Zoom bleibt erlaubt.
- Markierung wird beim Wechsel zu Anmeldung/SpielzeitApp und beim Unmount entfernt. Keine globalen Touch-Event-Sperren oder Änderungen an SpielzeitApp-LIVE.
- Regression für Setzen/Entfernen der Markierung, bestehende Markt-UI und Navi-Abstandsregeln sowie TypeScript/Produktionsbuild geprüft. Physischer iOS-Randzug/Bounce bleibt auf dem Gerät zu bestätigen.
