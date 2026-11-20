# Vereinsmarkt active season age

The TEST database ran the migration with the direct-join permission test in a rolled-back transaction. An active U12 and a draft U13 returned U12. Activating U13 returned U13 for the same team ID and updated the existing member profile. A custom display name remained visible. The test also covered anonymous and unconfirmed access, cross-club choices, revoked access and existing team selection. No club or membership records are migrated.
