import React from 'react';
import { Clock, MapPin, Trophy } from 'lucide-react';

const PLACEHOLDER =
  (import.meta.env.BASE_URL ?? '/').replace(/\/*$/, '') + '/logos/placeholder-shield-a.png';

/** Legacy-Exports für weitere Poster; die neue Spieltag-Grafik selbst nutzt kein Stadionbild mehr. */
export const MATCHDAY_POSTER_BG_ASSET = 'feed/matchday-stadium-smoke-bg.png';
export const MATCHDAY_POSTER_BG_FALLBACK = 'intro/welcome-hero.png';

function posterAssetUrl(path: string): string {
  const base = import.meta.env.BASE_URL || '/';
  return base.endsWith('/') ? `${base}${path}` : `${base}/${path}`;
}

export const MATCHDAY_POSTER_BG_URL = posterAssetUrl(MATCHDAY_POSTER_BG_ASSET);
export const MATCHDAY_POSTER_BG_FALLBACK_URL = posterAssetUrl(MATCHDAY_POSTER_BG_FALLBACK);

function PosterLogo({ src, alt }: { src: string; alt: string }) {
  const [imgSrc, setImgSrc] = React.useState(src || PLACEHOLDER);

  React.useEffect(() => {
    setImgSrc(src || PLACEHOLDER);
  }, [src]);

  return (
    <img
      src={imgSrc}
      alt={alt}
      className="h-[4.35rem] w-[4.35rem] shrink-0 object-contain sm:h-[5.15rem] sm:w-[5.15rem]"
      style={{ filter: 'drop-shadow(0 8px 16px rgba(0,0,0,0.72))' }}
      loading="lazy"
      onError={() => {
        if (!imgSrc.endsWith('/logos/placeholder-shield-a.png')) setImgSrc(PLACEHOLDER);
      }}
    />
  );
}

function PosterPlayerLayer({ playerImageUrl }: { playerImageUrl: string }) {
  const [failed, setFailed] = React.useState(false);

  React.useEffect(() => {
    setFailed(false);
  }, [playerImageUrl]);

  if (failed) return null;

  return (
    <div className="pointer-events-none absolute inset-0 z-[1] overflow-hidden rounded-[inherit]" aria-hidden>
      <div className="absolute bottom-[-6%] right-[-18%] h-[69%] w-[88%] rounded-full bg-red-700/20 blur-3xl" />
      <img
        src={playerImageUrl}
        alt=""
        className="absolute bottom-0 right-[-3%] h-[68%] w-[61%] object-contain object-bottom object-right sm:right-0 sm:h-[70%]"
        style={{ filter: 'drop-shadow(-12px 8px 24px rgba(0,0,0,0.9)) drop-shadow(0 0 22px rgba(185,28,28,0.34))' }}
        loading="lazy"
        onError={() => setFailed(true)}
      />
    </div>
  );
}

function GraphicBackground() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit] bg-[#050505]" aria-hidden>
      <div className="absolute inset-y-0 right-0 w-[72%] bg-[radial-gradient(ellipse_90%_68%_at_90%_55%,rgba(185,28,28,0.60)_0%,rgba(127,29,29,0.24)_38%,transparent_72%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(115deg,rgba(0,0,0,0.98)_0%,rgba(5,5,5,0.96)_44%,rgba(35,4,4,0.72)_100%)]" />
      <div className="absolute inset-y-0 right-0 w-[70%] bg-[radial-gradient(ellipse_75%_48%_at_88%_58%,rgba(220,38,38,0.32),transparent_72%)]" />
      <div className="absolute -right-[22%] top-[6%] h-[54%] w-[82%] rounded-[50%] border border-red-600/20" />
      <div className="absolute -right-[18%] top-[10%] h-[48%] w-[76%] rounded-[50%] border border-red-600/15" />
      <div className="absolute -right-[14%] top-[14%] h-[42%] w-[70%] rounded-[50%] border border-red-600/10" />
      <div className="absolute inset-0 opacity-[0.16] [background-image:repeating-linear-gradient(118deg,transparent_0,transparent_18px,rgba(239,68,68,0.12)_19px,transparent_20px)]" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_100%_80%_at_50%_42%,transparent_42%,rgba(0,0,0,0.58)_100%)]" />
    </div>
  );
}

function splitCompetitionLabel(label: string | null): { ageGroup: string | null; competition: string | null } {
  if (!label) return { ageGroup: null, competition: null };
  const parts = label.split('·').map((part) => part.trim()).filter(Boolean);
  const ageGroup = parts.find((part) => /^U\d+/i.test(part)) ?? null;
  const competition = parts.filter((part) => part !== ageGroup).join(' · ') || null;
  return { ageGroup, competition };
}

function TeamMark({ name, logoUrl }: { name: string; logoUrl: string }) {
  return (
    <div className="flex min-w-0 flex-1 flex-col items-center">
      <PosterLogo src={logoUrl} alt={name} />
      <p className="mt-1 line-clamp-2 min-h-[2.25rem] w-full break-words text-center text-[clamp(0.72rem,3.6vw,0.95rem)] font-black uppercase leading-[1.04] tracking-[-0.01em] text-white">
        {name}
      </p>
    </div>
  );
}

export type MatchdayPosterArtworkProps = {
  statusLabel: string;
  title: string;
  homeTeamName: string;
  awayTeamName: string;
  homeLogoUrl: string;
  awayLogoUrl: string;
  kickoffTime: string;
  matchDate?: string | null;
  meetingTime?: string | null;
  location?: string | null;
  competitionLabel?: string | null;
  isHomeGame?: boolean;
  hashtag?: string;
  playerImageUrl?: string | null;
  heroOverride?: { main: string; suffix?: string | null; livePulse?: boolean };
  showAnpfiffLabel?: boolean;
  statusBadge?: string | null;
  compact?: boolean;
};

export const MatchdayPosterArtwork = React.forwardRef<HTMLDivElement, MatchdayPosterArtworkProps>(
  function MatchdayPosterArtwork(
    {
      statusLabel,
      title,
      homeTeamName,
      awayTeamName,
      homeLogoUrl,
      awayLogoUrl,
      kickoffTime,
      matchDate = null,
      meetingTime = null,
      location = null,
      competitionLabel = null,
      isHomeGame,
      hashtag = '#GEMEINSAMEINTEAM',
      playerImageUrl = null,
      heroOverride,
      statusBadge = null,
    },
    ref,
  ) {
    const playerUrl = playerImageUrl?.trim() || null;
    const kickoff = kickoffTime.replace(/\s*uhr\s*$/i, '').trim() || '—';
    const venueLine = isHomeGame === true ? 'HEIMSPIEL' : isHomeGame === false ? 'AUSWÄRTSSPIEL' : null;
    const { ageGroup, competition } = splitCompetitionLabel(competitionLabel);
    const heroSuffix = heroOverride ? heroOverride.suffix : 'UHR';
    const cleanHashtag = hashtag.replace(/^#/, '');
    const teamSuffix = cleanHashtag.toUpperCase().endsWith('EINTEAM') ? 'EINTEAM' : '';
    const teamPrefix = teamSuffix ? cleanHashtag.slice(0, -teamSuffix.length) : cleanHashtag;

    return (
      <div ref={ref} className="relative aspect-[4/5] w-full overflow-hidden rounded-[inherit] bg-black text-white">
        <GraphicBackground />
        {playerUrl ? <PosterPlayerLayer playerImageUrl={playerUrl} /> : null}

        <div className="relative z-[2] flex h-full flex-col px-[6%] pb-[4.5%] pt-[4.5%]">
          <header className="shrink-0">
            <p className="mb-1 text-[clamp(0.38rem,1.9vw,0.55rem)] font-bold uppercase tracking-[0.36em] text-white/64">
              {statusLabel}
            </p>
            <h2
              className="whitespace-nowrap text-[clamp(3.1rem,17.2vw,5.15rem)] font-black uppercase leading-[0.78] tracking-[-0.055em] text-white"
              style={{ textShadow: '0 6px 24px rgba(0,0,0,0.82)' }}
            >
              {title}
            </h2>
            <div className="mt-2 flex items-center gap-3">
              <div className="h-[3px] flex-1 bg-red-600" />
              {ageGroup ? (
                <span className="text-[clamp(1.55rem,7.5vw,2.25rem)] font-black uppercase leading-none tracking-[-0.04em] text-red-600">
                  {ageGroup}
                </span>
              ) : null}
              <div className="h-[3px] flex-1 bg-red-600" />
            </div>
          </header>

          <div className="mt-[4%] flex w-[58%] shrink-0 items-start gap-2">
            <TeamMark name={homeTeamName} logoUrl={homeLogoUrl} />
            <div className="flex w-9 shrink-0 flex-col items-center pt-5 sm:w-11">
              <div className="h-8 w-[2px] rotate-[28deg] bg-red-600" />
              <span className="my-0.5 text-[clamp(1.3rem,6.5vw,1.9rem)] font-black uppercase leading-none text-red-600">VS</span>
              <div className="h-8 w-[2px] rotate-[28deg] bg-red-600" />
            </div>
            <TeamMark name={awayTeamName} logoUrl={awayLogoUrl} />
          </div>

          <div className="mt-auto mb-[13%] w-[48%] space-y-2.5 sm:space-y-3">
            {competition ? (
              <div className="flex items-center gap-1.5 text-[clamp(0.46rem,2.2vw,0.62rem)] font-bold uppercase tracking-[0.11em] text-white/64">
                <Trophy className="h-3 w-3 shrink-0 text-red-500" strokeWidth={2.5} aria-hidden />
                <span className="truncate">{competition}</span>
              </div>
            ) : null}
            {venueLine ? <p className="text-[clamp(0.52rem,2.5vw,0.7rem)] font-black tracking-[0.15em] text-red-500">{venueLine}</p> : null}
            {matchDate ? (
              <div className="border-y-2 border-red-600 py-1.5">
                <p className="text-[clamp(1.15rem,6.2vw,1.7rem)] font-black tabular-nums uppercase leading-none tracking-[-0.035em]">{matchDate}</p>
              </div>
            ) : null}
            <div className={matchDate ? '' : 'border-y-2 border-red-600 py-1.5'}>
              <p className="flex items-baseline gap-1 text-[clamp(1.25rem,6.5vw,1.8rem)] font-black tabular-nums uppercase leading-none tracking-[-0.035em]">
                {heroOverride?.main ?? kickoff}
                {heroSuffix ? (
                  <span className="text-[0.42em] tracking-[0.04em] text-white/76">{heroSuffix}</span>
                ) : null}
              </p>
            </div>
            {location && location !== '—' ? (
              <div>
                <div className="mb-0.5 flex items-center gap-1 text-[clamp(0.45rem,2.1vw,0.6rem)] font-black uppercase tracking-[0.16em] text-red-500">
                  <MapPin className="h-3 w-3" strokeWidth={2.5} aria-hidden /> ORT
                </div>
                <p className="line-clamp-3 text-[clamp(0.68rem,3.4vw,0.92rem)] font-black uppercase leading-[1.08] text-white">{location}</p>
              </div>
            ) : null}
            {meetingTime ? (
              <div className="flex items-center gap-1 text-[clamp(0.45rem,2.1vw,0.6rem)] font-bold uppercase tracking-[0.11em] text-white/62">
                <Clock className="h-3 w-3 text-red-500" strokeWidth={2.5} aria-hidden /> Treffpunkt {meetingTime}
              </div>
            ) : null}
            {statusBadge ? <p className="font-black uppercase tracking-[0.16em] text-red-400">{statusBadge}</p> : null}
          </div>

          <footer className="absolute inset-x-[4%] bottom-[3.2%] z-[3]">
            <p
              className="whitespace-nowrap text-center text-[clamp(1.48rem,7.8vw,2.3rem)] font-black italic uppercase leading-none tracking-[-0.045em]"
              style={{ textShadow: '0 4px 14px rgba(0,0,0,0.95)' }}
            >
              <span className="text-white">#{teamPrefix}</span><span className="text-red-600">{teamSuffix}</span>
            </p>
            <div className="mt-1.5 h-[3px] w-full bg-gradient-to-r from-transparent via-red-600 to-transparent" />
          </footer>
        </div>
      </div>
    );
  },
);

MatchdayPosterArtwork.displayName = 'MatchdayPosterArtwork';
