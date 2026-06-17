import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, Loader2, Radio } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { Button } from '../app/components/ui/Button';
import { dsPrimaryCtaClass } from '../lib/premiumDesignSystem';
import { cn } from '../ui/lib/cn';

type TeamSeasonOption = {
  id: string;
  label: string;
  teamTitle: string;
  seasonTitle: string;
};

function buildTeamSeasonParts(row: {
  teamName: string;
  ageGroup: string;
  seasonName: string;
}): { teamTitle: string; seasonTitle: string } {
  const nameNorm = row.teamName.replace(/\s+/g, ' ').trim();
  const ageNorm = row.ageGroup.replace(/\s+/g, ' ').trim();
  const alreadyStartsWithAge =
    (ageNorm && nameNorm && nameNorm.toLowerCase().startsWith(ageNorm.toLowerCase())) ||
    (nameNorm && /^u\d{1,2}\b/i.test(nameNorm));
  const teamTitle = (
    alreadyStartsWithAge
      ? nameNorm
      : [ageNorm, nameNorm].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim()
  ) || 'Team';
  const seasonTitle = row.seasonName.trim() || 'Aktuelle Saison';
  return { teamTitle, seasonTitle };
}

export const FanOnboardingPage: React.FC = () => {
  const navigate = useNavigate();
  const [userId, setUserId] = useState<string | null>(null);
  const [teamSeasons, setTeamSeasons] = useState<TeamSeasonOption[]>([]);
  const [selectedTeamSeasonId, setSelectedTeamSeasonId] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
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
        const { teamTitle, seasonTitle } = buildTeamSeasonParts({
          teamName: team.name,
          ageGroup: team.ageGroup,
          seasonName,
        });
        return {
          id: String(row.id),
          label: seasonName ? `${teamTitle} (${seasonName})` : teamTitle,
          teamTitle,
          seasonTitle,
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

    setSaved(true);
    navigate('/app/home', { replace: true });
    window.setTimeout(() => window.location.reload(), 450);
  };

  return (
    <div className="relative min-h-[calc(100dvh-var(--app-header-offset,5.35rem))] w-full overflow-x-hidden">
      <div
        className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[#14080a] via-[#060608] to-black"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-64 bg-[radial-gradient(ellipse_95%_85%_at_50%_-5%,rgba(220,38,38,0.24),transparent_68%)]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 h-48 bg-[radial-gradient(ellipse_80%_55%_at_50%_100%,rgba(127,29,29,0.14),transparent)]"
        aria-hidden
      />

      <div className="relative z-10 mx-auto flex min-h-[inherit] w-full max-w-lg flex-col px-3 pb-[max(6.5rem,calc(5rem+env(safe-area-inset-bottom,0px)))] pt-4 sm:px-4 sm:pt-5">
        <header className="shrink-0 space-y-2 text-center">
          <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-2xl border border-red-500/25 bg-red-950/30 shadow-[0_0_24px_rgba(220,38,38,0.2)]">
            <Radio className="h-5 w-5 text-red-400" strokeWidth={2.2} aria-hidden />
          </div>
          <h1 className="text-xl font-bold tracking-tight text-white sm:text-2xl">Dein Team verfolgen</h1>
          <p className="mx-auto max-w-[20rem] text-sm leading-relaxed text-white/62 sm:text-[15px]">
            Wähle dein Team und erhalte Spieltage, Ergebnisse und Live-Updates.
          </p>
        </header>

        <div className="mt-5 min-h-0 flex-1 space-y-3">
          {error ? (
            <div
              className="rounded-2xl border border-red-500/30 bg-red-950/25 px-4 py-3 text-sm text-red-200"
              role="alert"
            >
              {error}
            </div>
          ) : null}

          {loading ? (
            <div className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-12 text-center backdrop-blur-sm">
              <Loader2 className="h-6 w-6 animate-spin text-red-400/90" aria-hidden />
              <p className="text-sm text-white/55">Teams werden geladen…</p>
            </div>
          ) : loadError ? (
            <div className="space-y-3 rounded-2xl border border-white/10 bg-white/[0.04] p-4 backdrop-blur-sm">
              <p className="text-sm text-red-300">Die Team-Liste konnte nicht geladen werden.</p>
              <Button variant="primary" className="w-full" onClick={() => window.location.reload()}>
                Erneut laden
              </Button>
            </div>
          ) : teamSeasons.length === 0 ? (
            <div className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-8 text-center backdrop-blur-sm">
              <p className="text-sm text-white/60">
                Kein Team verfügbar. Bitte später erneut versuchen oder einen Trainer kontaktieren.
              </p>
            </div>
          ) : (
            <div className="space-y-2.5" role="listbox" aria-label="Team / Saison auswählen">
              {teamSeasons.map((ts) => {
                const selected = ts.id === selectedTeamSeasonId;
                return (
                  <button
                    key={ts.id}
                    type="button"
                    role="option"
                    aria-selected={selected}
                    onClick={() => setSelectedTeamSeasonId(ts.id)}
                    className={cn(
                      'w-full rounded-2xl border p-4 text-left transition-[border-color,background,box-shadow,transform] duration-150',
                      'min-h-[4.75rem] active:scale-[0.99]',
                      selected
                        ? 'border-red-500/50 bg-white/[0.08] shadow-[0_0_28px_rgba(220,38,38,0.16)] ring-1 ring-red-500/30'
                        : 'border-white/10 bg-white/[0.04] hover:border-white/18 hover:bg-white/[0.06]',
                    )}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-base font-semibold leading-snug text-white">{ts.teamTitle}</p>
                        <p className="mt-0.5 truncate text-sm text-white/68">{ts.seasonTitle}</p>
                        <p className="mt-2 text-xs text-white/42">Feed, Termine &amp; Live verfolgen</p>
                      </div>
                      <span
                        className={cn(
                          'mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border transition-colors',
                          selected
                            ? 'border-red-400/60 bg-red-600/80 text-white'
                            : 'border-white/15 bg-black/20 text-transparent',
                        )}
                        aria-hidden
                      >
                        <Check className="h-3.5 w-3.5" strokeWidth={2.8} />
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {!loading && !loadError && teamSeasons.length > 0 ? (
          <div className="sticky bottom-0 mt-4 shrink-0 border-t border-white/6 bg-[rgba(6,6,8,0.82)] pt-4 backdrop-blur-xl">
            <button
              type="button"
              disabled={saving || saved || !selectedTeamSeasonId}
              onClick={() => {
                void handleSave();
              }}
              className={cn(dsPrimaryCtaClass(), 'flex min-h-[48px] w-full items-center justify-center gap-2')}
            >
              {saved ? (
                <>
                  <Check className="h-4 w-4" aria-hidden />
                  Gespeichert
                </>
              ) : saving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  Wird gespeichert…
                </>
              ) : (
                'Team verfolgen'
              )}
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
};
