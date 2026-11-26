# Bestätigte Vorrundenzeiten im Turnierabgleich

Die Migration `20261125101039_tournament_confirmed_group_times.sql` mit Git-Blob `47da963ed161c385e509e8597addf24c7519ed7b` ergänzt eine private Tabelle und einen Trigger für bestätigte Vorrundenzeiten. Die Migration trägt keine Turnierdaten ein.

In LIVE wurden die referenzierten Spalten, der vorhandene Abgleich und mögliche konkurrierende Trigger lesend geprüft. Die Tabelle ist durch RLS und entzogene Rechte geschützt. Der Trigger wirkt ausschließlich auf separat hinterlegte Begegnungen desselben Turniers und derselben Quelle.

Der rückgerollte Test in TEST prüfte, dass mehrmaliges Laden des bisherigen Plans die bestätigten Zeiten und unveränderten Match-IDs beibehält. Eine tatsächlich geänderte Veranstalterzeit übernimmt der nächste Abgleich. Die technische Prüfung wurde mit synthetischen Daten durchgeführt.
