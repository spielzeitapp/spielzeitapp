import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { usePlayers } from '../hooks/usePlayers';
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

  const { players, loading: playersLoading } = usePlayers(
    selectedTeamSeasonId || null
  );

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
        setError(authError?.message ?? 'Kein Benutzer angemeldet.');
        setLoading(false);
        return;
      }

      setUserId(user.id);

      const { data, error: tsError } = await supabase
        .from('team_seasons')
        .select(
          `
          id,
          team:teams ( name ),
          season:seasons ( name )
        `
        )
        .order('id', { ascending: true });

      if (!alive) return;

      if (tsError) {
        setError(tsError.message);
        setTeamSeasons([]);
        setLoading(false);
        return;
      }

      const opts: TeamSeasonOption[] = (data ?? []).map((row: any) => {
        const team = Array.isArray(row.team) ? row.team[0] : row.team;
        const season = Array.isArray(row.season) ? row.season[0] : row.season;
        const teamName = (team?.name ?? 'Team').trim();
        const seasonName = (season?.name ?? '').trim();
        const label =
          seasonName !== '' ? `${teamName} (${seasonName})` : teamName;
        return { id: row.id as string, label };
      });

      setTeamSeasons(opts);
      if (opts.length > 0) {
        setSelectedTeamSeasonId(opts[0].id);
      }
      setLoading(false);
    }

    load().catch((e) => {
      if (!alive) return;
      setError(e?.message ?? 'Unbekannter Fehler beim Laden.');
      setLoading(false);
    });

    return () => {
      alive = false;
    };
  }, []);

  const handleSave = async () => {
    if (!userId || !selectedTeamSeasonId || !selectedPlayerId) {
      setError('Bitte Team und Kind auswählen.');
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

    console.log('[PARENT ONBOARDING MEMBERSHIP SAVE RESULT]', {
      data: membershipRes.data,
      error: membershipRes.error,
    });

    if (membershipRes.error) {
      setError(membershipRes.error.message ?? 'Speichern der Membership fehlgeschlagen.');
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
      console.log('[PARENT ONBOARDING PLAYER GUARDIAN SAVE RESULT]', { data: null, error: existing.error });
      setError(existing.error.message ?? 'Prüfung der Kind-Verknüpfung fehlgeschlagen.');
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

    console.log('[PARENT ONBOARDING PLAYER GUARDIAN SAVE RESULT]', {
      data: pgRes.data,
      error: pgRes.error,
    });

    if (pgRes.error) {
      setError(pgRes.error.message ?? 'Speichern der Kind-Verknüpfung fehlgeschlagen.');
      setSaving(false);
      return;
    }

    setSaving(false);
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
                  ) : players.length === 0 ? (
                    <p className="text-sm text-[var(--text-sub)]">
                      Für dieses Team sind keine aktiven Spieler erfasst.
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

