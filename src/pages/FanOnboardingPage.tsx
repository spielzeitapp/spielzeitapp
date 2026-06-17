import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabaseClient';
import { Button } from '../app/components/ui/Button';
import { Card, CardTitle } from '../app/components/ui/Card';

type TeamSeasonOption = {
  id: string;
  label: string;
};

function formatTeamSeasonLabel(row: {
  teamName: string;
  ageGroup: string;
  seasonName: string;
}): string {
  const nameNorm = row.teamName.replace(/\s+/g, ' ').trim();
  const ageNorm = row.ageGroup.replace(/\s+/g, ' ').trim();
  const alreadyStartsWithAge =
    (ageNorm && nameNorm && nameNorm.toLowerCase().startsWith(ageNorm.toLowerCase())) ||
    (nameNorm && /^u\d{1,2}\b/i.test(nameNorm));
  const base = alreadyStartsWithAge
    ? nameNorm
    : [ageNorm, nameNorm].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
  const displayBase = base || 'Team';
  const season = row.seasonName.trim();
  return season ? `${displayBase} (${season})` : displayBase;
}

export const FanOnboardingPage: React.FC = () => {
  const navigate = useNavigate();
  const [userId, setUserId] = useState<string | null>(null);
  const [teamSeasons, setTeamSeasons] = useState<TeamSeasonOption[]>([]);
  const [selectedTeamSeasonId, setSelectedTeamSeasonId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;

    async function load() {
      setLoading(true);
      setError(null);

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

      const { data: teamSeasonRows, error: tsError } = await supabase
        .from('team_seasons')
        .select('id, team_id, season_id');

      if (!alive) return;

      if (tsError) {
        const msg = tsError.message ?? 'Teams konnten nicht geladen werden.';
        setError(msg);
        setLoadError(msg);
        setTeamSeasons([]);
        setLoading(false);
        return;
      }

      const teamIds = [
        ...new Set((teamSeasonRows ?? []).map((row: { team_id?: string }) => row.team_id).filter(Boolean)),
      ];
      const seasonIds = [
        ...new Set((teamSeasonRows ?? []).map((row: { season_id?: string }) => row.season_id).filter(Boolean)),
      ];

      const [{ data: teamsRows, error: teamsError }, { data: seasonsRows, error: seasonsError }] =
        await Promise.all([
          supabase.from('teams').select('id, name, age_group').in('id', teamIds),
          supabase.from('seasons').select('id, name').in('id', seasonIds),
        ]);

      if (!alive) return;

      if (teamsError || seasonsError) {
        const msg =
          teamsError?.message ?? seasonsError?.message ?? 'Teamdaten konnten nicht geladen werden.';
        setError(msg);
        setLoadError(msg);
        setTeamSeasons([]);
        setLoading(false);
        return;
      }

      const teamById = new Map(
        (teamsRows ?? []).map((row: { id: string; name?: string; age_group?: string }) => [
          String(row.id),
          {
            name: String(row.name ?? 'Team').trim(),
            ageGroup: String(row.age_group ?? '').trim(),
          },
        ]),
      );
      const seasonById = new Map(
        (seasonsRows ?? []).map((row: { id: string; name?: string }) => [
          String(row.id),
          String(row.name ?? '').trim(),
        ]),
      );

      const opts: TeamSeasonOption[] = (teamSeasonRows ?? []).map((row: {
        id: string;
        team_id?: string;
        season_id?: string;
      }) => {
        const team = teamById.get(String(row.team_id ?? '')) ?? { name: 'Team', ageGroup: '' };
        const seasonName = seasonById.get(String(row.season_id ?? '')) ?? '';
        return {
          id: String(row.id),
          label: formatTeamSeasonLabel({
            teamName: team.name,
            ageGroup: team.ageGroup,
            seasonName,
          }),
        };
      });

      opts.sort((a, b) => a.label.localeCompare(b.label, 'de'));

      setTeamSeasons(opts);
      if (opts.length > 0) {
        setSelectedTeamSeasonId(opts[0].id);
      }
      setLoading(false);
    }

    load().catch((e) => {
      if (!alive) return;
      const msg = e?.message ?? 'Onboarding konnte nicht geladen werden.';
      setError(msg);
      setLoadError(msg);
      setLoading(false);
    });

    return () => {
      alive = false;
    };
  }, []);

  const handleSave = async () => {
    if (!userId || !selectedTeamSeasonId) {
      const msg = 'Bitte Team / Saison auswählen.';
      setError(msg);
      return;
    }

    setSaving(true);
    setError(null);

    const membershipRes = await supabase
      .from('memberships')
      .upsert(
        {
          user_id: userId,
          team_season_id: selectedTeamSeasonId,
          role: 'fan',
        },
        { onConflict: 'user_id,team_season_id' },
      )
      .select('user_id, team_season_id, role');

    if (membershipRes.error) {
      const msg = membershipRes.error.message ?? 'Speichern der Team-Auswahl fehlgeschlagen.';
      setError(msg);
      setSaving(false);
      return;
    }

    navigate('/app/home', { replace: true });
    window.location.reload();
  };

  return (
    <div className="page relative min-h-[60vh] px-4 pt-6">
      <div className="mx-auto max-w-[720px]">
        <Card>
          <div className="space-y-4">
            <CardTitle>Team auswählen</CardTitle>
            <p className="text-sm text-[var(--text-sub)]">
              Als Fan folgst du einem Team und siehst Termine, Infos und Live-Spiele.
            </p>

            {error && (
              <p className="text-sm text-red-500" role="alert">
                {error}
              </p>
            )}

            {loading ? (
              <p className="text-sm text-[var(--text-sub)]">Lade Teams…</p>
            ) : loadError ? (
              <div className="space-y-3">
                <p className="text-sm text-red-400">
                  Es gab ein Problem beim Laden der Team-Liste.
                </p>
                <Button variant="primary" className="w-full" onClick={() => window.location.reload()}>
                  Erneut laden
                </Button>
              </div>
            ) : teamSeasons.length === 0 ? (
              <p className="text-sm text-[var(--text-sub)]">
                Kein Team verfügbar. Bitte später erneut versuchen oder einen Trainer kontaktieren.
              </p>
            ) : (
              <>
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-[var(--text-main)]">
                    Team / Saison
                  </label>
                  <select
                    className="w-full rounded-lg border border-[var(--glass-border)] bg-[var(--glass-bg)] px-3 py-2 text-sm text-[var(--text-main)]"
                    value={selectedTeamSeasonId}
                    onChange={(e) => setSelectedTeamSeasonId(e.target.value)}
                  >
                    {teamSeasons.map((ts) => (
                      <option key={ts.id} value={ts.id}>
                        {ts.label}
                      </option>
                    ))}
                  </select>
                </div>

                <Button
                  variant="primary"
                  className="w-full"
                  disabled={saving || !selectedTeamSeasonId}
                  onClick={() => {
                    void handleSave();
                  }}
                >
                  {saving ? 'Speichern…' : 'Team übernehmen'}
                </Button>
              </>
            )}
          </div>
        </Card>
      </div>
    </div>
  );
};
