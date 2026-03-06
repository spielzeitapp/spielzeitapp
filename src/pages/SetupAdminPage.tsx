import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { supabase } from '../lib/supabaseClient';

type TeamSeasonOption = { id: number; label: string };

/** team_seasons ohne seasons.year – nur id, name. */
async function loadTeamSeasons(): Promise<TeamSeasonOption[]> {
  const { data, error } = await supabase
    .from('team_seasons')
    .select('id, team_id, season_id, team:teams(id,name), season:seasons(id,name)')
    .order('id', { ascending: true });

  if (!error && data && data.length > 0) {
    return (data as unknown[]).map((row: unknown) => {
      const r = row as { id: number; team?: { name: string } | { name: string }[]; season?: { name: string } | { name: string }[] };
      const team = Array.isArray(r.team) ? r.team[0] : r.team;
      const season = Array.isArray(r.season) ? r.season[0] : r.season;
      const teamName = team?.name ?? '';
      const seasonLabel = season?.name ?? '—';
      const label = teamName || seasonLabel ? `${teamName} – ${seasonLabel}` : `ID ${r.id}`;
      return { id: r.id, label };
    });
  }

  const fallback = await supabase.from('team_seasons').select('id').order('id', { ascending: true });
  if (fallback.error || !fallback.data?.length) return [];
  return (fallback.data as { id: number }[]).map((r) => ({ id: r.id, label: `ID ${r.id}` }));
}

export const SetupAdminPage: React.FC = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [teamSeasons, setTeamSeasons] = useState<TeamSeasonOption[]>([]);
  const [setupCode, setSetupCode] = useState('');
  const [teamSeasonId, setTeamSeasonId] = useState<number | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);

  const isDev = import.meta.env.DEV;

  useEffect(() => {
    let cancelled = false;
    loadTeamSeasons().then((list) => {
      if (!cancelled) {
        setTeamSeasons(list);
        if (list.length > 0) setTeamSeasonId((prev) => (prev == null ? list[0].id : prev));
      }
    });
    return () => { cancelled = true; };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSuccess(false);
    if (!user) {
      setError('Bitte zuerst einloggen.');
      return;
    }
    if (teamSeasonId == null) {
      setError('Bitte eine TeamSeason auswählen.');
      return;
    }
    setSubmitLoading(true);
    try {
      const { data, error: fnError } = await supabase.functions.invoke('setup-admin', {
        body: { code: setupCode.trim(), teamSeasonId: String(teamSeasonId) },
      });

      if (fnError) {
        const ctx = fnError.context as Response | undefined;
        if (ctx?.status === 403) setError('Ungültiger Setup-Code.');
        else setError(fnError.message ?? 'Edge Function Fehler');
        setSubmitLoading(false);
        return;
      }

      const err = (data as { error?: string })?.error;
      if (err) {
        setError(err);
        setSubmitLoading(false);
        return;
      }

      setSuccess(true);
      setTimeout(() => window.location.reload(), 800);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unbekannter Fehler');
    } finally {
      setSubmitLoading(false);
    }
  };

  if (!isDev) {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center px-4 py-8">
        <p className="text-center text-white/80">Nicht verfügbar</p>
        <p className="mt-2 text-center text-sm text-white/60">Diese Seite ist nur im Entwicklungsmodus erreichbar.</p>
      </div>
    );
  }

  if (authLoading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center text-white/70">
        Laden…
      </div>
    );
  }

  if (!user) {
    return (
      <div className="flex min-h-[40vh] flex-col items-center justify-center px-4 py-8">
        <h1 className="text-xl font-semibold text-white">Admin Setup</h1>
        <p className="mt-2 text-center text-white/70">Du musst eingeloggt sein, um Admin-Rechte zu setzen.</p>
        <button
          type="button"
          onClick={() => navigate('/login')}
          className="mt-4 rounded bg-[var(--primary)] px-4 py-2 text-sm font-medium text-white hover:opacity-90"
        >
          Login
        </button>
      </div>
    );
  }

  return (
    <div className="flex min-h-[40vh] flex-col items-center px-4 py-8">
      <div className="w-full max-w-md space-y-4">
        <h1 className="text-xl font-semibold text-white">Admin Setup</h1>
        <p className="text-sm text-white/60">Nur für initiales Setup. Mit gültigem Code kannst du Admin-Rechte für eine TeamSeason erhalten.</p>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="setup-code" className="block text-sm font-medium text-white/80">
              Setup-Code
            </label>
            <input
              id="setup-code"
              type="password"
              value={setupCode}
              onChange={(e) => setSetupCode(e.target.value)}
              className="mt-1 w-full rounded border border-[var(--border)] bg-black/40 px-3 py-2 text-white placeholder:text-white/40 focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
              placeholder="Setup-Code eingeben"
              autoComplete="off"
            />
          </div>

          <div>
            <label htmlFor="team-season" className="block text-sm font-medium text-white/80">
              TeamSeason
            </label>
            <select
              id="team-season"
              value={teamSeasonId ?? ''}
              onChange={(e) => setTeamSeasonId(e.target.value === '' ? null : Number(e.target.value))}
              className="mt-1 w-full rounded border border-[var(--border)] bg-black/40 px-3 py-2 text-white focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
            >
              {teamSeasons.length === 0 && <option value="">Keine TeamSeasons geladen</option>}
              {teamSeasons.map((ts) => (
                <option key={ts.id} value={ts.id}>
                  {ts.label}
                </option>
              ))}
            </select>
          </div>

          {error && (
            <p className="rounded bg-red-500/20 px-3 py-2 text-sm text-red-300" role="alert">
              {error}
            </p>
          )}
          {success && (
            <p className="rounded bg-green-500/20 px-3 py-2 text-sm text-green-300" role="status">
              Erfolgreich. Seite wird neu geladen…
            </p>
          )}

          <button
            type="submit"
            disabled={submitLoading || teamSeasons.length === 0}
            className="w-full rounded bg-[var(--primary)] py-2 text-sm font-medium text-white hover:opacity-90 disabled:opacity-50"
          >
            {submitLoading ? 'Wird ausgeführt…' : 'Admin setzen'}
          </button>
        </form>
      </div>
    </div>
  );
};
