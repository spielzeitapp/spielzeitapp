import React, { useCallback, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { MapPin, Radio, RefreshCw, Share2 } from 'lucide-react';
import {
  fetchPublicTeamTournamentPage,
  sharePublicTeamTournamentPage,
  type PublicTeamTournamentMatchDto,
  type PublicTeamTournamentPageDto,
} from '../../lib/publicTeamTournament';
import { getOurTeamLogoUrl } from '../../lib/teamLogos';
import { TournamentClubLogo } from '../../components/tournament/TournamentClubLogo';

function TeamMark({
  name,
  logoUrl,
  highlight,
  size = 'regular',
}: {
  name: string;
  logoUrl?: string | null;
  highlight?: boolean;
  size?: 'featured' | 'regular';
}) {
  const featured = size === 'featured';
  return (
    <div
      className={`flex min-w-0 flex-1 flex-col items-center text-center ${
        featured ? 'gap-2.5' : 'gap-2'
      }`}
    >
      <TournamentClubLogo
        name={name}
        logoUrl={logoUrl}
        size={featured ? 'xl' : 'lg'}
        tone="light"
      />
      <p
        className={`line-clamp-2 font-semibold leading-snug ${
          featured ? 'text-[13px] sm:text-[14px]' : 'text-[12px] sm:text-[13px]'
        } ${highlight ? 'text-slate-950' : 'text-slate-700'}`}
      >
        {name}
      </p>
    </div>
  );
}

function StatusPill({
  status,
  label,
}: {
  status: PublicTeamTournamentMatchDto['status'] | PublicTeamTournamentPageDto['tournamentStatus'];
  label: string;
}) {
  const cls =
    status === 'live'
      ? 'border-red-200 bg-red-50 text-red-700'
      : status === 'finished'
        ? 'border-slate-200 bg-slate-100 text-slate-600'
        : status === 'canceled'
          ? 'border-amber-200 bg-amber-50 text-amber-800'
          : 'border-slate-200 bg-white text-slate-600';
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wide ${cls}`}
    >
      {status === 'live' ? <Radio className="h-3 w-3" aria-hidden /> : null}
      {label}
    </span>
  );
}

function MatchCard({
  match,
  featured,
  ourLogoUrl,
}: {
  match: PublicTeamTournamentMatchDto;
  featured?: boolean;
  ourLogoUrl: string | null;
}) {
  const scoreReady = match.scoreOur != null && match.scoreOpp != null;
  const markSize = featured ? 'featured' : 'regular';
  return (
    <article
      className={`rounded-2xl border bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)] sm:p-5 ${
        featured
          ? 'border-red-200 shadow-[0_8px_28px_rgba(220,38,38,0.08)]'
          : 'border-slate-200/90'
      }`}
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          {featured ? (
            <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-red-600">
              Nächstes Spiel
            </span>
          ) : null}
          <StatusPill status={match.status} label={match.statusLabel} />
        </div>
        <p
          className={`font-bold tabular-nums leading-none text-slate-950 ${
            featured ? 'text-[26px] sm:text-[30px]' : 'text-[24px] sm:text-[28px]'
          }`}
        >
          {match.kickoffTimeLabel}
        </p>
      </div>

      <div className={`flex items-start ${featured ? 'gap-2.5 sm:gap-3.5' : 'gap-2 sm:gap-3'}`}>
        <TeamMark
          name={match.homeName}
          logoUrl={match.ourIsHome ? ourLogoUrl : undefined}
          highlight={match.ourIsHome}
          size={markSize}
        />
        <div
          className={`flex shrink-0 flex-col items-center justify-center ${
            featured ? 'w-[4.25rem] pt-5 sm:w-20 sm:pt-6' : 'w-14 pt-4 sm:w-16 sm:pt-5'
          }`}
        >
          {scoreReady ? (
            <p
              className={`font-bold tabular-nums text-slate-950 ${
                featured ? 'text-[26px] sm:text-[30px]' : 'text-[22px] sm:text-[26px]'
              }`}
            >
              {match.scoreOur}:{match.scoreOpp}
            </p>
          ) : (
            <p className={`font-semibold text-slate-300 ${featured ? 'text-[18px]' : 'text-[16px]'}`}>
              vs
            </p>
          )}
        </div>
        <TeamMark
          name={match.awayName}
          logoUrl={!match.ourIsHome ? ourLogoUrl : undefined}
          highlight={!match.ourIsHome}
          size={markSize}
        />
      </div>

      <div className="mt-3.5 flex flex-wrap gap-x-3 gap-y-1 text-[12px] text-slate-500">
        {match.pitch ? <span>Platz: {match.pitch}</span> : null}
        {match.groupLabel ? <span>Gruppe {match.groupLabel}</span> : null}
        {match.phase && match.phase !== 'group' && match.phase !== 'unknown' ? (
          <span className="capitalize">{match.phase}</span>
        ) : null}
      </div>
    </article>
  );
}

function ResultRow({ match, ourLogoUrl }: { match: PublicTeamTournamentMatchDto; ourLogoUrl: string | null }) {
  return (
    <li className="flex items-center gap-3 rounded-xl border border-slate-200/90 bg-white px-3 py-3">
      <div className="w-14 shrink-0 text-center">
        <p className="text-[18px] font-bold tabular-nums text-slate-900">{match.kickoffTimeLabel}</p>
      </div>
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <TournamentClubLogo name={match.ourTeamName} logoUrl={ourLogoUrl} size="sm" tone="light" />
        <div className="min-w-0 flex-1">
          <p className="line-clamp-2 text-[13px] font-semibold leading-snug text-slate-900">{match.ourTeamName}</p>
          <p className="line-clamp-2 text-[13px] leading-snug text-slate-600">{match.opponentName}</p>
        </div>
      </div>
      <p className="shrink-0 text-[20px] font-bold tabular-nums text-slate-950">
        {match.scoreOur ?? 0}:{match.scoreOpp ?? 0}
      </p>
    </li>
  );
}

export function PublicTeamTournamentPage(): React.ReactElement {
  const { publicId = '' } = useParams<{ publicId: string }>();
  const [page, setPage] = useState<PublicTeamTournamentPageDto | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [shareHint, setShareHint] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const result = await fetchPublicTeamTournamentPage(publicId);
    setPage(result.page);
    setError(result.error);
    setLoading(false);
  }, [publicId]);

  useEffect(() => {
    void load();
  }, [load]);

  const onShare = async () => {
    if (!page) return;
    const result = await sharePublicTeamTournamentPage(page.tournamentName, page.publicId);
    setShareHint(
      result === 'shared'
        ? 'Geteilt'
        : result === 'copied'
          ? 'Link kopiert'
          : 'Teilen nicht verfügbar',
    );
    window.setTimeout(() => setShareHint(null), 2200);
  };

  const ourLogo = page?.teamLogoUrl || getOurTeamLogoUrl();

  return (
    <div className="min-h-screen bg-[linear-gradient(180deg,#f8fafc_0%,#fff5f5_42%,#ffffff_100%)] text-slate-900">
      <div className="mx-auto flex w-full max-w-lg flex-col px-4 pb-16 pt-5 sm:max-w-xl sm:px-6">
        <header className="mb-5 flex items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-red-600">SpielzeitApp</p>
            <h1 className="mt-1 text-[22px] font-bold leading-tight tracking-tight text-slate-950 sm:text-[26px]">
              Turnierseite
            </h1>
          </div>
          {page ? (
            <button
              type="button"
              onClick={() => void onShare()}
              className="inline-flex min-h-[44px] items-center gap-1.5 rounded-full border border-red-200 bg-white px-3.5 text-[13px] font-semibold text-red-700 shadow-sm touch-manipulation"
            >
              <Share2 className="h-4 w-4" aria-hidden />
              Teilen
            </button>
          ) : null}
        </header>

        {shareHint ? (
          <p className="mb-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-[12px] text-emerald-800" role="status">
            {shareHint}
          </p>
        ) : null}

        {loading ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
            Turnierseite wird geladen…
          </div>
        ) : error || !page ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-6 text-center shadow-sm">
            <p className="text-[16px] font-semibold text-slate-900">Seite nicht verfügbar</p>
            <p className="mt-2 text-[14px] leading-relaxed text-slate-600">
              {error || 'Dieser Link ist ungültig oder das Turnier wurde nicht freigegeben.'}
            </p>
            <button
              type="button"
              onClick={() => void load()}
              className="mt-4 inline-flex min-h-[44px] items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-4 text-[13px] font-semibold text-slate-800"
            >
              <RefreshCw className="h-4 w-4" aria-hidden />
              Erneut versuchen
            </button>
          </div>
        ) : (
          <>
            <section className="rounded-2xl border border-slate-200/90 bg-white p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
              <div className="flex items-start gap-3">
                <TournamentClubLogo name={page.teamName} logoUrl={ourLogo} size="lg" tone="light" />
                <div className="min-w-0 flex-1">
                  <div className="mb-1 flex flex-wrap items-center gap-2">
                    {page.ageGroupLabel ? (
                      <span className="rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-slate-600">
                        {page.ageGroupLabel}
                      </span>
                    ) : null}
                    <StatusPill
                      status={page.tournamentStatus}
                      label={page.tournamentStatusLabel}
                    />
                  </div>
                  <p className="text-[15px] font-bold text-slate-950">{page.teamName}</p>
                  <h2 className="mt-1 text-[20px] font-bold leading-snug text-slate-950">
                    {page.tournamentName}
                  </h2>
                  <div className="mt-2 space-y-1 text-[13px] text-slate-600">
                    {page.dateLabel ? <p>{page.dateLabel}</p> : null}
                    {page.venue ? (
                      <p className="inline-flex items-start gap-1.5">
                        <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0 text-red-500" aria-hidden />
                        <span>{page.venue}</span>
                      </p>
                    ) : null}
                  </div>
                </div>
              </div>
            </section>

            {page.allMatches.length === 0 ? (
              <section className="mt-4 rounded-2xl border border-dashed border-slate-300 bg-white/80 p-6 text-center">
                <p className="text-[15px] font-semibold text-slate-900">Noch kein Spielplan</p>
                <p className="mt-1 text-[13px] text-slate-600">
                  Für unser Team sind noch keine Turnierspiele hinterlegt.
                </p>
              </section>
            ) : (
              <>
                {page.nextMatch ? (
                  <section className="mt-5 space-y-3">
                    <MatchCard match={page.nextMatch} featured ourLogoUrl={ourLogo} />
                  </section>
                ) : null}

                {page.upcomingMatches.length > 0 ? (
                  <section className="mt-6">
                    <h3 className="mb-3 text-[12px] font-bold uppercase tracking-[0.12em] text-slate-500">
                      Weitere Spiele
                    </h3>
                    <div className="space-y-3">
                      {page.upcomingMatches.map((m) => (
                        <MatchCard key={m.id} match={m} ourLogoUrl={ourLogo} />
                      ))}
                    </div>
                  </section>
                ) : null}

                {page.results.length > 0 ? (
                  <section className="mt-6">
                    <h3 className="mb-3 text-[12px] font-bold uppercase tracking-[0.12em] text-slate-500">
                      Ergebnisse
                    </h3>
                    <ul className="space-y-2">
                      {page.results.map((m) => (
                        <ResultRow key={m.id} match={m} ourLogoUrl={ourLogo} />
                      ))}
                    </ul>
                  </section>
                ) : null}
              </>
            )}

            <p className="mt-8 text-center text-[11px] text-slate-400">
              Nur Spiele von {page.teamName}
            </p>
            <p className="mt-3 text-center text-[12px]">
              <Link to="/login" className="font-semibold text-red-600 hover:underline">
                Zur App anmelden
              </Link>
            </p>
          </>
        )}
      </div>
    </div>
  );
}
