# Tournament formations, match defaults and time penalties

- Compared the LIVE and TEST policies for events, matches, match events, tournament matches and lineup templates. The policies and existing staff and lineup RPC definitions matched. The LIVE formation validator and match-event type constraint were inspected read-only before release.
- Ran synthetic TEST transactions as authenticated team staff and as an unrelated authenticated user. Verified saving and applying all three 5+1 formations with six players, mismatched inputs and stale writes.
- Verified defaults on existing and newly linked own games, preservation of match-specific and finished-game values, rejection of an invalid minimum, stale writes and unauthorized access. Verified that a time penalty can persist as a player-linked card with a duration. Rolled back the fixtures.
- The timer uses effective match seconds. The penalty interval is excluded from the player's minutes while the player has a field assignment. The trainer remains responsible for lineup changes and the player's actual return. There is no automatic player replacement on timer expiry.
