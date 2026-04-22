import React from 'react';
import { getMatchTypeLabel } from '../match/matchCardLabels';

const PLACEHOLDER =
  (import.meta.env.BASE_URL ?? '/').replace(/\/*$/, '') + '/logos/placeholder-shield-a.png';

/** Wie Welcome Screen (`HomePage`): tiefer Schwarz–Rot-Verlauf + Stadion-Inset-Glow. */
const WELCOME_GRADIENT =
  'linear-gradient(180deg, rgba(40,5,5,0.97) 0%, rgba(20,0,0,0.98) 50%, rgba(10,0,0,0.99) 100%)';
const WELCOME_INSET = 'inset 0 0 120px rgba(120,20,20,0.12)';

export type MatchdayPosterVisualStatus = 'today' | 'live' | 'finished';

export type MatchdayPosterCardProps = {
  homeTeamName: string;
  awayTeamName: string;
  homeLogoUrl: string;
  awayLogoUrl: string;
  kickoffTime: string;
  meetingTime: string | null;
  locationLine: string;
  venueLabel: string;
  status: MatchdayPosterVisualStatus;
  homeScore?: number | null;
  awayScore?: number | null;
  matchType?: string | null;
};

function LogoImg({ src, alt }: { src: string; alt: string }) {
  const [failed, setFailed] = React.useState(false);
  const url = failed ? PLACEHOLDER : src || PLACEHOLDER;
  return (
    <img
      src={url}
      alt={alt}
      className="h-[4.75rem] w-[4.75rem] shrink-0 object-contain sm:h-[5.75rem] sm:w-[5.75rem]"
      loading="lazy"
      onError={() => setFailed(true)}
    />
  );
}

export const MatchdayPosterCard: React.FC<MatchdayPosterCardProps> = ({
  homeTeamName,
  awayTeamName,
  homeLogoUrl,
  awayLogoUrl,
  kickoffTime,
  meetingTime,
  locationLine,
  venueLabel,
  status,
  homeScore,
  awayScore,
  matchType,
}) => {
  const typeLabel = getMatchTypeLabel(matchType ?? undefined);

  let badgeText = 'HEUTE';
  if (status === 'live') badgeText = 'LIVE';
  if (status === 'finished') {
    const hs = homeScore != null ? homeScore : null;
    const aws = awayScore != null ? awayScore : null;
    badgeText = hs != null && aws != null ? `ENDSTAND ${hs}:${aws}` : 'ENDSTAND';
  }

  return (
    <div
      className="relative w-full overflow-hidden rounded-3xl border border-red-950/50 px-4 py-6 sm:px-7 sm:py-8"
      style={{
        background: WELCOME_GRADIENT,
        boxShadow: `${WELCOME_INSET}, 0 0 0 1px rgba(220,38,38,0.1), 0 24px 48px rgba(0,0,0,0.5)`,
      }}
    >
      {/* Dezente Flutlicht-Stimmung oben — kein überladenes Spotlight */}
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.09]"
        style={{
          background:
            'radial-gradient(ellipse 95% 55% at 50% 0%, rgba(248,113,113,0.55), transparent 72%)',
        }}
      />
      <div
        className="pointer-events-none absolute inset-0 opacity-40"
        style={{
          background: 'radial-gradient(ellipse 80% 50% at 50% 100%, rgba(0,0,0,0.55), transparent 65%)',
        }}
      />

      <div className="relative z-[1] flex flex-col items-center space-y-6 sm:space-y-7">
        {/* Branding + emotionale Bühnenzeile — nah an Welcome (Kicker rot, Headline weiß) */}
        <div className="w-full max-w-md space-y-2 text-center">
          <p className="text-[10px] font-bold uppercase tracking-[0.26em] text-red-400 sm:text-[11px]">
            Matchday
          </p>
          <h2 className="text-xl font-bold leading-tight text-white sm:text-2xl">
            Heute ist{' '}
            <span className="text-white [text-shadow:0_0_32px_rgba(220,38,38,0.22)]">Matchday</span>
          </h2>
          <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-white/88 sm:text-xs">
            SpielzeitApp
          </p>
          {typeLabel ? (
            <p className="pt-0.5 text-xs font-medium text-white/55 sm:text-sm">{typeLabel}</p>
          ) : null}
          <p className="text-xs text-white/55 sm:text-sm">{venueLabel}</p>
        </div>

        {/* Duell — großzügig für Share / Thumbnail */}
        <div className="flex w-full max-w-lg items-center justify-between gap-2 sm:gap-5">
          <div className="flex min-w-0 flex-1 flex-col items-center gap-3">
            <LogoImg src={homeLogoUrl} alt={homeTeamName} />
            <p className="w-full px-0.5 text-center text-[13px] font-semibold leading-snug text-white/92 sm:text-base">
              {homeTeamName}
            </p>
          </div>

          <div className="flex shrink-0 flex-col items-center justify-center px-1 sm:px-2">
            <div
              className="mb-1.5 h-10 w-px sm:h-12"
              style={{
                background: 'linear-gradient(180deg, transparent, rgba(255,255,255,0.2), transparent)',
              }}
            />
            <span className="text-[11px] font-semibold uppercase tracking-[0.42em] text-white/45 sm:text-xs">
              vs
            </span>
            <div
              className="mt-1.5 h-10 w-px sm:h-12"
              style={{
                background: 'linear-gradient(180deg, transparent, rgba(255,255,255,0.2), transparent)',
              }}
            />
          </div>

          <div className="flex min-w-0 flex-1 flex-col items-center gap-3">
            <LogoImg src={awayLogoUrl} alt={awayTeamName} />
            <p className="w-full px-0.5 text-center text-[13px] font-semibold leading-snug text-white/92 sm:text-base">
              {awayTeamName}
            </p>
          </div>
        </div>

        {/* Infos — ruhig, editorial */}
        <div
          className="w-full max-w-md space-y-2 rounded-2xl border border-white/[0.06] bg-black/20 px-4 py-3.5 text-center sm:px-5 sm:py-4"
          style={{ boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.04)' }}
        >
          <p className="text-xs text-white/82 sm:text-sm">
            <span className="font-semibold text-red-300/90">Anpfiff</span>
            <span className="text-white/35"> · </span>
            {kickoffTime}
          </p>
          {meetingTime ? (
            <p className="text-xs text-white/78 sm:text-sm">
              <span className="font-semibold text-red-300/90">Treffpunkt</span>
              <span className="text-white/35"> · </span>
              {meetingTime}
            </p>
          ) : null}
          <p className="text-xs leading-relaxed text-white/68 sm:text-sm">
            <span className="font-semibold text-red-300/90">Ort</span>
            <span className="text-white/35"> · </span>
            {locationLine || '—'}
          </p>
        </div>

        <div className="flex w-full flex-col items-center gap-2.5 pt-1">
          <div
            className={
              status === 'live'
                ? 'inline-flex min-h-[2.25rem] items-center justify-center rounded-full border border-red-500/35 bg-red-600/85 px-5 py-1.5 text-[11px] font-bold uppercase tracking-[0.2em] text-white sm:text-xs [animation-duration:1.5s] motion-safe:animate-pulse'
                : 'inline-flex min-h-[2.25rem] items-center justify-center rounded-full border border-red-500/30 bg-red-950/65 px-5 py-1.5 text-[11px] font-bold uppercase tracking-[0.2em] text-red-100 sm:text-xs'
            }
            style={{
              boxShadow: '0 0 28px rgba(185,28,28,0.25), inset 0 1px 0 rgba(255,255,255,0.08)',
            }}
          >
            {badgeText}
          </div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-white/38">
            #GEMEINSAMEINTEAM
          </p>
        </div>
      </div>
    </div>
  );
};
