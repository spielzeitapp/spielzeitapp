import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { Button } from '../app/components/ui/Button';
import { Card, CardTitle } from '../app/components/ui/Card';

type TeamSeasonOption = {
  id: string;
  label: string;
};

export const ParentOnboardingPage: React.FC = () => {
  const navigate = useNavigate();
  const [userId, setUserId] = useState<string | null>(null);
  const [teamSeasons, setTeamSeasons] = useState<TeamSeasonOption[]>([]);
  const [selectedTeamSeasonId, setSelectedTeamSeasonId] = useState<string>('');
  const [selectedPlayerId, setSelectedPlayerId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [players, setPlayers] = useState<
    { id: string; display_name: string; jersey_number: number | null }[]
  >([]);
  const [playersLoading, setPlayersLoading] = useState(false);
  const [playersError, setPlayersError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;

    async function load() {
      setLoading(true);
      setError(null);

      const { data: userRes, error: authError } = await supabase.auth.getUser();
      const user = userRes?.user ?? null;
      console.log('[PARENT ONBOARDING AUTH USER]', { user, authError });

      if (!alive) return;

      if (authError || !user) {
        const msg = authError?.message ?? 'Kein Benutzer angemeldet.';
        console.log('[PARENT ONBOARDING LOAD ERROR]', msg);
        setError(msg);
        setLoadError(msg);
        setLoading(false);
        return;
      }

      setUserId(user.id);

      console.log('[PARENT TEAM LOAD START]');

      const { data: teamSeasonRows, error: tsError } = await supabase
        .from('team_seasons')
        .select('id, team_id');

      console.log('[PARENT TEAM LOAD RAW TEAM_SEASONS]', {
        data: teamSeasonRows,
        error: tsError,
      });

      if (!alive) return;

      if (tsError) {
        const msg = tsError.message ?? 'Teams konnten nicht geladen werden.';
        console.log('[PARENT ONBOARDING LOAD ERROR]', msg);
        setError(msg);
        setLoadError(msg);
        setTeamSeasons([]);
        setLoading(false);
        return;
      }

      const teamIds = [
        ...new Set((teamSeasonRows ?? []).map((row: any) => row.team_id).filter(Boolean)),
      ];

      const { data: teamsRows, error: teamsError } = await supabase
        .from('teams')
        .select('id, name')
        .in('id', teamIds);

      console.log('[PARENT TEAM LOAD RAW TEAMS]', {
        data: teamsRows,
        error: teamsError,
      });

      if (!alive) return;

      if (teamsError) {
        const msg = teamsError.message ?? 'Teamnamen konnten nicht geladen werden.';
        console.log('[PARENT ONBOARDING LOAD ERROR]', msg);
        setError(msg);
        setLoadError(msg);
        setTeamSeasons([]);
        setLoading(false);
        return;
      }

      const teamNameById = new Map(
        (teamsRows ?? []).map((row: any) => [String(row.id), String(row.name ?? 'Team')]),
      );

      const opts: TeamSeasonOption[] = (teamSeasonRows ?? []).map((row: any) => ({
        id: String(row.id),
        label: (teamNameById.get(String(row.team_id)) ?? 'Team').toString().trim(),
      }));

      console.log('[PARENT TEAM OPTIONS]', opts);

      setTeamSeasons(opts);
      if (opts.length > 0) {
        const firstId = opts[0].id;
        setSelectedTeamSeasonId(firstId);
      }
      setLoading(false);
    }

    load().catch((e) => {
      if (!alive) return;
      const msg = e?.message ?? 'Unbekannter Fehler beim Laden.';
      console.log('[PARENT ONBOARDING LOAD ERROR]', msg);
      setError(msg);
      setLoadError(msg);
      setLoading(false);
    });

    return () => {
      alive = false;
    };
  }, []);

  // Spieler für ausgewählte team_season_id laden
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

      console.log('[PARENT PLAYER LOAD START]', { teamSeasonId });

      const { data, error } = await supabase
        .from('players')
        .select('id, first_name, last_name, jersey_number, team_season_id')
        .eq('team_season_id', teamSeasonId)
        .order('last_name', { ascending: true });

      if (!alive) return;

      console.log('[PARENT PLAYER LOAD RAW]', { data, error });

      if (error) {
        console.log('[PARENT ONBOARDING PLAYER LOAD ERROR]', error);
        setPlayers([]);
        setPlayersError(error.message ?? 'Spieler konnten nicht geladen werden.');
        setPlayersLoading(false);
        return;
      }

      const rows = (data ?? []) as {
        id: string;
        first_name: string | null;
        last_name: string | null;
        jersey_number: number | null;
      }[];

      console.log('[PARENT PLAYER LOAD RESULT]', {
        rowCount: rows.length,
        ids: rows.map((r) => r.id),
      });

      const mapped = rows.map((r) => {
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
      setPlayersLoading(false);
    }

    loadPlayersForTeam(selectedTeamSeasonId).catch((e) => {
      console.log('[PARENT ONBOARDING PLAYER LOAD ERROR]', e);
      if (!alive) return;
      setPlayers([]);
      setPlayersError(e?.message ?? 'Spieler konnten nicht geladen werden.');
      setPlayersLoading(false);
    });

    return () => {
      alive = false;
    };
  }, [selectedTeamSeasonId]);

  const handleSave = async () => {
      if (!userId || !selectedTeamSeasonId || !selectedPlayerId) {
        const msg = 'Bitte Team und Kind auswählen.';
        console.log('[PARENT ONBOARDING SAVE ERROR]', msg, {
          userId,
          selectedTeamSeasonId,
          selectedPlayerId,
        });
        setError(msg);
        return;
      }

    console.log('[PARENT ONBOARDING TEAM SELECTED]', { teamSeasonId: selectedTeamSeasonId });
    console.log('[PARENT ONBOARDING PLAYER SELECTED]', { playerId: selectedPlayerId });

    setSaving(true);
    setError(null);

    const membershipRes = await supabase
      .from('memberships')
      .upsert(
        {
          user_id: userId,
          team_season_id: selectedTeamSeasonId,
          role: 'parent',
        },
        { onConflict: 'user_id,team_season_id' }
      )
      .select('user_id, team_season_id, role');

    console.log('[PARENT MEMBERSHIP UPSERT RESULT]', {
      data: membershipRes.data,
      error: membershipRes.error,
    });

    if (membershipRes.error) {
      const msg = membershipRes.error.message ?? 'Speichern der Membership fehlgeschlagen.';
      console.log('[PARENT ONBOARDING SAVE ERROR]', msg);
      setError(msg);
      setSaving(false);
      return;
    }

    // player_guardians: nicht doppelt anlegen (ohne Annahme über Unique-Constraint).
    const existing = await supabase
      .from('player_guardians')
      .select('user_id, player_id')
      .eq('user_id', userId)
      .eq('player_id', selectedPlayerId)
      .maybeSingle();
    if (existing.error && existing.error.code !== 'PGRST116') {
      console.log('[PARENT GUARDIAN UPSERT RESULT]', { data: null, error: existing.error });
      const msg = existing.error.message ?? 'Prüfung der Kind-Verknüpfung fehlgeschlagen.';
      console.log('[PARENT ONBOARDING SAVE ERROR]', msg);
      setError(msg);
      setSaving(false);
      return;
    }

    const pgRes = existing.data
      ? { data: existing.data, error: null as any }
      : await supabase
          .from('player_guardians')
          .insert({
            user_id: userId,
            player_id: selectedPlayerId,
          })
          .select('user_id, player_id')
          .maybeSingle();

    console.log('[PARENT GUARDIAN UPSERT RESULT]', {
      data: pgRes.data,
      error: pgRes.error,
    });

    if (pgRes.error) {
      const msg = pgRes.error.message ?? 'Speichern der Kind-Verknüpfung fehlgeschlagen.';
      console.log('[PARENT ONBOARDING SAVE ERROR]', msg);
      setError(msg);
      setSaving(false);
      return;
    }

    setSaving(false);
    // Passwort wurde bereits bei der Registrierung gesetzt; nach erfolgreichem Onboarding
    // direkt in den normalen Flow (/app/schedule) leiten.
    navigate('/app/schedule', { replace: true });
  };

  return (
    <div className="page relative min-h-[60vh] px-4 pt-6">
      <div className="mx-auto max-w-[720px]">
        <Card>
          <div className="space-y-4">
            <CardTitle>Kind verknüpfen</CardTitle>
            <p className="text-sm text-[var(--text-sub)]">
              Bitte wähle Team und Kind aus.
            </p>

            {error && (
              <p className="text-sm text-red-500" role="alert">
                {error}
              </p>
            )}

            {loading ? (
              <p className="text-sm text-[var(--text-sub)]">Lade Daten…</p>
            ) : loadError ? (
              <div className="space-y-3">
                <p className="text-sm text-red-400">
                  Es gab ein Problem beim Laden der Onboarding-Daten.
                </p>
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Button
                    variant="primary"
                    className="flex-1"
                    onClick={() => {
                      console.log('[PARENT ONBOARDING RETRY]');
                      window.location.reload();
                    }}
                  >
                    Erneut laden
                  </Button>
                  <Button
                    variant="ghost"
                    className="flex-1"
                    onClick={async () => {
                      console.log('[AUTH LOGOUT START]');
                      try {
                        await supabase.auth.signOut();
                        console.log('[AUTH LOGOUT SUCCESS]');
                        navigate('/login', { replace: true });
                      } catch (e) {
                        console.error('[AUTH LOGOUT ERROR]', e);
                      }
                    }}
                  >
                    Abmelden
                  </Button>
                </div>
              </div>
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
                    <p className="text-sm text-[var(--text-sub)]">
                      Lade Spieler…
                    </p>
                  ) : playersError ? (
                    <p className="text-sm text-[var(--text-sub)]">
                      Spieler konnten nicht geladen werden.
                    </p>
                  ) : players.length === 0 ? (
                    <p className="text-sm text-[var(--text-sub)]">
                      Kein Spieler gefunden. Bitte Trainer kontaktieren.
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

                <div className="pt-2">
                  <Button
                    variant="primary"
                    className="w-full"
                    onClick={handleSave}
                    disabled={saving || !selectedTeamSeasonId || !selectedPlayerId}
                  >
                    {saving ? 'Speichere…' : 'Verknüpfung speichern'}
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

