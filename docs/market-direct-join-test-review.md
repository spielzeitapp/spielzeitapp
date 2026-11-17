# TEST direct market join review

The normal club market URL supports confirmed parents selecting their own teams without an invitation token. Enabled separately in TEST for USC Rohrbach. The generic migration enables no club and contains no TEST club IDs. No LIVE deployment or release-plan approval was made.

Migration 20261117195858_exchange_direct_market_join adds private, RLS-enabled, client-inaccessible settings and a private SECURITY DEFINER join operation with an invoker public wrapper. It checks authenticated, confirmed, non-anonymous identity, opt-in active club, self-declaration, one to twenty valid local/partner team IDs, and administrator suspension. Club locking matches existing joins and suspensions; settings use a share lock. Repeated calls replace and deduplicate the user's selected teams. It grants only market access and creates no app membership or child link.

Validation: direct-join synthetic rollback SQL under authenticated role passed consent, confirmation, disabled and foreign clubs, empty/foreign teams, repeatability, settings disabled after options loaded, administrative suspension, absent identity, table privilege denial and no app/child assignments. Existing invited-join synthetic RLS regression passed unchanged. Actual TEST account's token-free team options checked separately. UI tests passed both token-free and invitation-based paths. Typecheck, build and auth localization tests passed.

Security advisor reports RLS without policies for the private settings table. Intentional default-deny: all client table grants are revoked; only owner-executed private functions inspect these settings. Other pre-existing advisor findings were outside this change. Concurrency lock order was reviewed; simultaneous-session contention was not exercised.
