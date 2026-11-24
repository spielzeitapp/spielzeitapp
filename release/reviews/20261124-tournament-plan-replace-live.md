# Turnierplan ersetzen in LIVE

Migration [20261124114411_tournament_plan_replace.sql](../../supabase/migrations/20261124114411_tournament_plan_replace.sql), Git-Blob `703482441f2d92b25efc15d545fd249bf35b6473`. Die Veröffentlichung übernimmt die zwei geprüften Turnierimport-Änderungen aus TEST.

Die lesende LIVE-Prüfung bestätigte die benötigten Spalten, die unveränderte Signatur und Implementierung von `tournament_sync.reconcile` sowie die mit TEST übereinstimmenden Rollenprüfungen. Die Fremdschlüssel auf Spiele entsprechen TEST. Der optionale Fremdschlüssel für Turnieranmeldungen existiert nur in TEST. Die Migration ändert die Reihenfolge der Sperren im bestehenden Import und richtet eine zusätzliche RPC ein. Die Migration selbst bearbeitet keine Turnierdaten.

In TEST wurden die Fälle in einer zurückgerollten Transaktion geprüft. Enthalten waren ein erfolgreicher Wechsel, fehlende Berechtigung, ein leerer und ein ungültiger Plan, ein begonnenes Spiel sowie eine wiederholte und eine veraltete Bestätigung. Mit den beiden NextPro-Varianten blieben nach dem Ersetzen 6 Teams und 15 Spiele übrig, davon 5 Rohrbach-Spiele. Die Ausgangsdaten umfassten 8 Teams und 20 Spiele.

Die vollständige Ersetzung ist auf Turniere ohne begonnene Spiele und ohne Ergebnisse beschränkt. Ein echter Turnierplanwechsel in LIVE erfolgt durch die berechtigte Person im jeweiligen Turnier.
