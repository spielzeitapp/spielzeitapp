import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { listRoster } from '../lib/rosterService';
import { Button } from '../app/components/ui/Button';
import { Card, CardTitle } from '../app/components/ui/Card';
import { canManageMatches, normalizeRole as normalizeRoleKey } from '../lib/roles';
import { useSession } from '../auth/useSession';
import {
  clearParentLinkDeferred,
  listActiveTeamSeasonsForParentLink,
  setParentLinkDeferred,
  userHasPlayerGuardian,
  type ParentLinkTeamSeasonOption,
} from '../lib/parentChildLink';

type PlayerOption = {
  id: string;
  display_name: string;
  jersey_number: number | null;
};

function isLinkMode(
  searchParams: URLSearchParams,
  locationState: unknown,
): boolean {
  if (searchParams.get('mode') === 'link') return true;
  if (
    locationState &&
    typeof locationState === 'object' &&
    'mode' in locationState &&
    (locationState as { mode?: unknown }).mode === 'link'
  ) {
    return true;
  }
  return false;
}

export const ParentOnboardingPage: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const { setPreviewRole } = useSession();
  const linkMode = isLinkMode(searchParams, location.state);

  const [userId, setUserId] = useState<string | null>(null);
  const [teamSeasons, setTeamSeasons] = useState<ParentLinkTeamSeasonOption[]>([]);
  const [selectedTeamSeasonId, setSelectedTeamSeasonId] = useState('');
  const [selectedPlayerId, setSelectedPlayerId] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deferring, setDeferring] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [players, setPlayers] = useState<PlayerOption[]>([]);
  const [playersLoading, setPlayersLoading] = useState(false);
  const [playersError, setPlayersError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;

    async function load() {
      setLoading(true);
      setError(null);
      setLoadError(null);

      const { data: userRes, error: authError } = await supabase.auth.getUser();
      const user = userRes?.user ?? null;

      if (!alive) return;

      if (authError || !user) {
        const msg = authError?.message ?? 'Kein Benutzer angemeldet.';
        setError(msg);
        setLoadError(msg);
        setLoading(false);
        return;
      }

      setUserId(user.id);

      const { hasGuardian, error: guardianError } = await userHasPlayerGuardian(user.id);
      if (!alive) return;

      if (guardianError) {
        console.warn('[PARENT ONBOARDING] Guardian-Check fehlgeschlagen', guardianError);
        setError(guardianError);
        setLoadError(guardianError);
        setLoading(false);
        return;
      }

      if (hasGuardian) {
        navigate('/app/home', { replace: true });
        return;
      }

      const { data: opts, error: seasonsError } = await listActiveTeamSeasonsForParentLink();
      if (!alive) return;

      if (seasonsError) {
        setError(seasonsError);
        setLoadError(seasonsError);
        setTeamSeasons([]);
        setLoading(false);
        return;
      }

      setTeamSeasons(opts);
      if (opts.length > 0) {
        setSelectedTeamSeasonId(opts[0].id);
      } else {
        setSelectedTeamSeasonId('');
      }
      setLoading(false);
    }

    load().catch((e) => {
      if (!alive) return;
      const msg = e?.message ?? 'Unbekannter Fehler beim Laden.';
      setError(msg);
      setLoadError(msg);
      setLoading(false);
    });

    return () => {
      alive = false;
    };
  }, [navigate, linkMode]);

  useEffect(() => {
    let alive = true;

    async function loadPlayersForTeam(teamSeasonId: string) {
      if (!teamSeasonId) {
        setPlayers([]);
        setPlayersLoading(false);
        setPlayersError(null);
        return;
      }

      setPlayersLoading(true);
      setPlayersError(null);

      const { data, error } = await listRoster(teamSeasonId, 'active');
      if (!alive) return;

      if (error) {
        setPlayers([]);
        setPlayersError(error ?? 'Spieler konnten nicht geladen werden.');
        setPlayersLoading(false);
        return;
      }

      const mapped: PlayerOption[] = data.map((r) => {
        const first = (r.first_name ?? '').toString().trim();
        const last = (r.last_name ?? '').toString().trim();
        const display_name = `${first} ${last}`.trim() || 'Spieler';
        return {
          id: r.id,
          display_name,
          jersey_number: r.jersey_number ?? null,
        };
      });

      setPlayers(mapped);
      setSelectedPlayerId('');
      setPlayersLoading(false);
    }

    loadPlayersForTeam(selectedTeamSeasonId).catch((e) => {
      if (!alive) return;
      setPlayers([]);
      setPlayersError(e?.message ?? 'Spieler konnten nicht geladen werden.');
      setPlayersLoading(false);
    });

    return () => {
      alive = false;
    };
  }, [selectedTeamSeasonId]);

  const noSeasons = !loading && !loadError && teamSeasons.length === 0;
  const noPlayersForSeason =
    !loading &&
    !loadError &&
    !!selectedTeamSeasonId &&
    !playersLoading &&
    !playersError &&
    players.length === 0;
  const noChildSelectable = noSeasons || noPlayersForSeason;

  const goHomeAndReload = () => {
    navigate('/app/home', { replace: true });
    window.location.reload();
  };

  const handleDefer = async () => {
    setDeferring(true);
    setError(null);

    const { error: deferError } = await setParentLinkDeferred(true);
    if (deferError) {
      setError(deferError);
      setDeferring(false);
      return;
    }

    setPreviewRole('parent');
    goHomeAndReload();
  };

  const handleSave = async () => {
    if (!userId || !selectedTeamSeasonId || !selectedPlayerId) {
      setError('Bitte Team und Kind auswählen.');
      return;
    }

    setSaving(true);
    setError(null);

    const { data: existingMembership, error: existingMembershipError } = await supabase
      .from('memberships')
      .select('role')
      .eq('user_id', userId)
      .eq('team_season_id', selectedTeamSeasonId)
      .maybeSingle();

    if (existingMembershipError && existingMembershipError.code !== 'PGRST116') {
      setError(
        existingMembershipError.message ??
          'Bestehende Mitgliedschaft konnte nicht geprüft werden.',
      );
      setSaving(false);
      return;
    }

    const existingMembershipRole = normalizeRoleKey(existingMembership?.role ?? null);
    const preserveStaffMembership =
      existingMembershipRole != null && canManageMatches(existingMembershipRole);

    if (!preserveStaffMembership) {
      const membershipRes = await supabase
        .from('memberships')
        .upsert(
          {
            user_id: userId,
            team_season_id: selectedTeamSeasonId,
            role: 'parent',
          },
          { onConflict: 'user_id,team_season_id' },
        )
        .select('user_id, team_season_id, role');

      if (membershipRes.error) {
        setError(membershipRes.error.message ?? 'Speichern der Membership fehlgeschlagen.');
        setSaving(false);
        return;
      }
    } else {
      console.log('[PARENT ONBOARDING] Staff-Membership bleibt unverändert', {
        role: existingMembershipRole,
        teamSeasonId: selectedTeamSeasonId,
      });
    }

    const existing = await supabase
      .from('player_guardians')
      .select('user_id, player_id')
      .eq('user_id', userId)
      .eq('player_id', selectedPlayerId)
      .maybeSingle();

    if (existing.error && existing.error.code !== 'PGRST116') {
      setError(existing.error.message ?? 'Prüfung der Kind-Verknüpfung fehlgeschlagen.');
      setSaving(false);
      return;
    }

    const pgRes = existing.data
      ? { data: existing.data, error: null as null }
      : await supabase
          .from('player_guardians')
          .insert({
            user_id: userId,
            player_id: selectedPlayerId,
          })
          .select('user_id, player_id')
          .maybeSingle();

    if (pgRes.error) {
      setError(pgRes.error.message ?? 'Speichern der Kind-Verknüpfung fehlgeschlagen.');
      setSaving(false);
      return;
    }

    try {
      const selectedSeason = teamSeasons.find((ts) => ts.id === selectedTeamSeasonId);
      let teamId = selectedSeason?.teamId ?? null;

      if (!teamId) {
        const { data: tsRow, error: tsError } = await supabase
          .from('team_seasons')
          .select('team_id')
          .eq('id', selectedTeamSeasonId)
          .maybeSingle();
        if (!tsError && tsRow?.team_id) {
          teamId = tsRow.team_id as string;
        }
      }

      if (teamId) {
        const selectedPlayer = players.find((p) => p.id === selectedPlayerId);
        const childName = selectedPlayer?.display_name ?? null;

        const { data: existingReq, error: checkError } = await supabase
          .from('join_requests')
          .select('id, status')
          .eq('user_id', userId)
          .eq('team_id', teamId)
          .eq('requested_role', 'parent')
          .eq('status', 'pending')
          .maybeSingle();

        if (checkError) {
          console.warn('[PARENT ONBOARDING] join_request check', checkError);
        }

        if (!existingReq) {
          const { error: jrError } = await supabase.from('join_requests').insert({
            user_id: userId,
            team_id: teamId,
            requested_role: 'parent',
            child_name: childName,
            status: 'pending',
          } as any);

          if (jrError) {
            console.warn('[PARENT ONBOARDING] join_request insert', jrError);
          }
        }
      }
    } catch (e) {
      console.warn('[PARENT ONBOARDING] join_request exception', e);
    }

    await clearParentLinkDeferred();
    setSaving(false);
    goHomeAndReload();
  };

  if (loading) {
    return (
      <div className="page relative min-h-[60vh] px-4 pt-6">
        <div className="mx-auto max-w-[720px]">
          <Card>
            <div className="space-y-4">
              <CardTitle>Kind verknüpfen</CardTitle>
              <p className="text-sm text-[var(--text-sub)]">Lade…</p>
            </div>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="page relative min-h-[60vh] px-4 pt-6">
      <div className="mx-auto max-w-[720px]">
        <Card>
          <div className="space-y-4">
            <CardTitle>Kind verknüpfen</CardTitle>
            <p className="text-sm text-[var(--text-sub)]">
              {linkMode
                ? 'Verknüpfe jetzt dein Kind mit deinem Eltern-Konto.'
                : 'Bitte wähle Team und Kind aus.'}
            </p>

            {error && (
              <p className="text-sm text-red-500" role="alert">
                {error}
              </p>
            )}

            {loadError ? (
              <div className="space-y-3">
                <p className="text-sm text-red-400">
                  Es gab ein Problem beim Laden der Onboarding-Daten.
                </p>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Button
                    variant="primary"
                    className="flex-1"
                    onClick={() => window.location.reload()}
                  >
                    Erneut laden
                  </Button>
                  <Button
                    variant="ghost"
                    className="flex-1"
                    onClick={async () => {
                      try {
                        await supabase.auth.signOut();
                        navigate('/login', { replace: true });
                      } catch (e) {
                        console.error('[PARENT ONBOARDING] Abmelden fehlgeschlagen', e);
                      }
                    }}
                  >
                    Abmelden
                  </Button>
                </div>
              </div>
            ) : (
              <>
                {noSeasons ? (
                  <p className="text-sm text-[var(--text-sub)]">
                    Derzeit ist kein Kind auswählbar. Du kannst diesen Schritt überspringen und
                    die Verknüpfung später durchführen.
                  </p>
                ) : (
                  <>
                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-[var(--text-main)]">
                        Team auswählen
                      </label>
                      <select
                        className="w-full rounded-lg border border-[var(--glass-border)] bg-[var(--glass-bg)] px-3 py-2 text-sm text-[var(--text-main)]"
                        value={selectedTeamSeasonId}
                        onChange={(e) => {
                          setSelectedTeamSeasonId(e.target.value);
                          setSelectedPlayerId('');
                        }}
                      >
                        {teamSeasons.map((ts) => (
                          <option key={ts.id} value={ts.id}>
                            {ts.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-[var(--text-main)]">
                        Kind auswählen
                      </label>
                      {playersLoading ? (
                        <p className="text-sm text-[var(--text-sub)]">Lade…</p>
                      ) : playersError ? (
                        <p className="text-sm text-[var(--text-sub)]">
                          Spieler konnten nicht geladen werden.
                        </p>
                      ) : noPlayersForSeason ? (
                        <p className="text-sm text-[var(--text-sub)]">
                          Derzeit ist kein Kind auswählbar. Du kannst diesen Schritt überspringen
                          und die Verknüpfung später durchführen.
                        </p>
                      ) : (
                        <div className="space-y-2 max-h-[260px] overflow-y-auto rounded-xl border border-[var(--glass-border)] bg-[var(--glass-bg)] px-3 py-2">
                          {players.map((p) => (
                            <label
                              key={p.id}
                              className="flex items-center justify-between gap-3 py-1.5"
                            >
                              <div className="flex items-center gap-2">
                                <input
                                  type="radio"
                                  name="child"
                                  className="h-4 w-4"
                                  checked={selectedPlayerId === p.id}
                                  onChange={() => setSelectedPlayerId(p.id)}
                                />
                                <span className="text-sm text-[var(--text-main)]">
                                  {p.display_name}
                                </span>
                              </div>
                              {p.jersey_number != null && (
                                <span className="rounded-full bg-white/10 px-2 py-0.5 text-xs text-[var(--text-sub)]">
                                  #{p.jersey_number}
                                </span>
                              )}
                            </label>
                          ))}
                        </div>
                      )}
                    </div>

                    {!noChildSelectable && (
                      <div className="pt-2">
                        <Button
                          variant="primary"
                          className="w-full"
                          onClick={handleSave}
                          disabled={
                            saving ||
                            deferring ||
                            playersLoading ||
                            !selectedTeamSeasonId ||
                            !selectedPlayerId
                          }
                        >
                          {saving ? 'Speichere…' : 'Verknüpfung speichern'}
                        </Button>
                      </div>
                    )}
                  </>
                )}

                <div className="pt-2">
                  <Button
                    variant={noChildSelectable ? 'primary' : 'ghost'}
                    className="w-full"
                    onClick={handleDefer}
                    disabled={saving || deferring}
                  >
                    {deferring ? 'Weiter…' : 'Später verknüpfen'}
                  </Button>
                </div>
              </>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
};
