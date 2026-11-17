# Public Vereinsmarkt information: 17 November 2026

Operator confirmed by Johannes: QUETSCHNGURU e.U. independently operates the marketplace; the club administers membership/access. This edit clarifies the actual role, self-selected team join, optional team display and optional icon/push flow. It removes TEST labels from the four legal/help pages and preserves their previous text in archive/2026-11-17-before-public-clarification.

No paid shop, new data-sharing requirement or blanket privacy consent is introduced. Registration still requires the separate existing terms checkbox; optional sharing and native push remain opt-in. Acceptance version 2026-11-17 remains unchanged for this same-day operational clarification; do not imply existing users accepted a new version or rewrite acceptance records. The archived prior text is retained for reviewing the wording they saw.

## Evidence and verification limits

Inspected registration, membership controls, notification hook and server/push/unsubscribe.js. Current auth mail transport uses Resend via server/lib/sendParentInviteEmail.js. The UI status checks the actual subscription. Push-reminder storage pauses reminders for seven days without promising that the key itself expires. No database, permissions or deletion job was changed.

Actual signed provider agreements, subprocessors, transfer bases and provider-specific log/backup retention are NOT verified by this change. The public privacy text retains explicit disclosure of these unresolved facts. Confirm the actual provider/project settings and contractual documents before representing the information as a completed legal review. No EU-only processing, invented backup lifetime, automatic account cleanup or completed DPA is claimed.

## Reference material consulted

- Austrian DSB information duties: https://dsb.gv.at/rechte-pflichten/ihre-rechte-als-betroffene-person
- Controller roles depend on actual purposes/means: https://www.edpb.europa.eu/sme/learn-the-basics/data-controller-or-data-processor_en
- GDPR information on retention duration or criteria: https://eur-lex.europa.eu/eli/reg/2016/679

Validation: parsed all four pages; checked their local legal-page links and operator contact; confirmed TEST labels removed and unresolved-fact disclosure retained; git diff --check passed. This static text change requires no database migration or runtime-code build.
