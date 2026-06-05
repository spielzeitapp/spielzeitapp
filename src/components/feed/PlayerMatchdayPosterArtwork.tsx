import React from 'react';
import { Clock, MapPin } from 'lucide-react';
import { FeedClubName } from './FeedClubName';
import { getClubLogo } from '../../lib/teamLogos';
import {
  MATCHDAY_POSTER_BG_FALLBACK_URL,
  MATCHDAY_POSTER_BG_URL,
} from './MatchdayPosterArtwork';

const PLACEHOLDER =
  (import.meta.env.BASE_URL ?? '/').replace(/\/*$/, '') + '/logos/placeholder-shield-a.png';

function posterAssetUrl(path: string): string {
  const base = import.meta.env.BASE_URL || '/';
  return base.endsWith('/') ? `${base}${path}` : `${base}/${path}`;
}

/** Prototyp-Cutout — Datei: public/feed/test-player-daniel.PNG */
export const PLAYER_MATCHDAY_PROTOTYPE_CUTOUT = posterAssetUrl('feed/test-player-daniel.PNG');

const TITLE_SHADOW =
  '0 0 44px rgba(220,38,38,0.32), 0 4px 24px rgba(0,0,0,0.92), 0 2px 0 rgba(0,0,0,0.58), 2px 2px 10px rgba(0,0,0,0.5)';
const KICKOFF_SHADOW =
  '0 3px 26px rgba(0,0,0,0.9), 0 0 42px rgba(220,38,38,0.22), 1px 1px 0 rgba(0,0,0,0.45)';
const VS_LIGHTNING =
  'linear-gradient(180deg, transparent 0%, rgba(248,113,113,0.22) 12%, rgba(220,38,38,0.95) 50%, rgba(248,113,113,0.22) 88%, transparent 100%)';
const LOGO_GLOW = 'drop-shadow(0 0 18px rgba(220,38,38,0.24))';
const PLAYER_GLOW =
  'drop-shadow(0 0 32px rgba(220,38,38,0.42)) drop-shadow(0 8px 24px rgba(0,0,0,0.55))';

const HOME_TEAM = 'SKN St.Pölten';
const AWAY_TEAM = 'SPG Rohrbach';
const KICKOFF = '15:00 Uhr';
const MEETING = '14:15 Uhr';
const VENUE = 'NV Arena, St. Pölten';

function PosterLogo({ src, alt }: { src: string; alt: string }) {
  const [imgSrc, setImgSrc] = React.useState(src || PLACEHOLDER);
  React.useEffect(() => {
    setImgSrc(src || PLACEHOLDER);
  }, [src]);

  return (
    <img
      src={imgSrc}
      alt={alt}
      className="h-[4.25rem] w-[4.25rem] shrink-0 object-contain sm:h-[5rem] sm:w-[5rem]"
      style={{ filter: LOGO_GLOW }}
      loading="lazy"
      onError={() => {
        if (!imgSrc.endsWith('/logos/placeholder-shield-a.png')) setImgSrc(PLACEHOLDER);
      }}
    />
  );
}

function StadiumBackground() {
  const [bgSrc, setBgSrc] = React.useState(MATCHDAY_POSTER_BG_URL);

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit]" aria-hidden>
      <img
        src={bgSrc}
        alt=""
        className="absolute inset-0 h-full w-full object-cover object-center"
        onError={() => {
          if (bgSrc !== MATCHDAY_POSTER_BG_FALLBACK_URL) setBgSrc(MATCHDAY_POSTER_BG_FALLBACK_URL);
        }}
      />
      <div className="absolute inset-0 bg-black/22" />
      <div className="absolute inset-0 bg-gradient-to-b from-black/52 via-black/18 to-black/58" />
      <div className="absolute inset-0 bg-gradient-to-r from-black/38 via-transparent to-black/12" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_88%_58%_at_42%_42%,transparent_32%,rgba(0,0,0,0.28)_100%)]" />
    </div>
  );
}

function PlayerCutoutLayer() {
  const [failed, setFailed] = React.useState(false);
  if (failed) return null;

  return (
    <div
      className="pointer-events-none absolute inset-0 z-[1] overflow-hidden rounded-[inherit]"
      aria-hidden
    >
      <img
        src={PLAYER_MATCHDAY_PROTOTYPE_CUTOUT}
        alt=""
        className="absolute bottom-0 right-0 w-[45%] max-w-[45%] object-contain object-bottom object-right"
        style={{ filter: PLAYER_GLOW }}
        loading="lazy"
        onError={() => setFailed(true)}
      />
    </div>
  );
}

function VsLightningDivider() {
  return (
    <div
      className="h-9 w-[3px] sm:h-11"
      style={{ background: VS_LIGHTNING, boxShadow: '0 0 20px rgba(220,38,38,0.62)' }}
      aria-hidden
    />
  );
}

function MetaColumn({
  icon: Icon,
  label,
  value,
  align,
}: {
  icon: typeof Clock;
  label: string;
  value: string;
  align: 'left' | 'right';
}) {
  return (
    <div className={`min-w-0 ${align === 'right' ? 'text-right' : 'text-left'}`}>
      <div
        className={`mb-0.5 flex items-center gap-0.5 text-[8px] font-bold uppercase tracking-[0.12em] text-red-400/95 sm:text-[9px] ${
          align === 'right' ? 'justify-end' : 'justify-start'
        }`}
      >
        <Icon className="h-3 w-3 shrink-0" strokeWidth={2.5} aria-hidden />
        <span>{label}</span>
      </div>
      <p className="line-clamp-2 break-words text-[9px] font-semibold leading-snug text-white/78 sm:text-[10px]">
        {value}
      </p>
    </div>
  );
}

/**
 * Prototyp: Matchday-Poster mit Spieler-Cutout (Daniel).
 * Hardcoded Demo — keine DB, keine Autopost-Anbindung.
 */
export const PlayerMatchdayPosterArtwork = React.forwardRef<HTMLDivElement>(
  function PlayerMatchdayPosterArtwork(_props, ref) {
    const homeLogo = getClubLogo(HOME_TEAM);
    const awayLogo = getClubLogo(AWAY_TEAM);
    const kickoffMain = KICKOFF.replace(/\s*uhr\s*$/i, '').trim();

    return (
      <div
        ref={ref}
        className="relative aspect-[4/5] w-full max-w-[320px] overflow-hidden rounded-[inherit] sm:max-w-none"
      >
        {/* Background Layer */}
        <div className="absolute inset-0 z-0">
          <StadiumBackground />
        </div>

        {/* Player Layer */}
        <PlayerCutoutLayer />

        {/* Content Layer */}
        <div className="relative z-[2] flex h-full min-h-0 flex-col justify-between px-2.5 py-3 pb-3.5 text-center sm:px-3 sm:py-3.5 sm:pb-4">
          <div className="w-full shrink-0 space-y-0.5">
            <h2
              className="mx-auto w-full max-w-[94%] text-[clamp(2.45rem,15.5vw,3.65rem)] font-black uppercase leading-[0.8] tracking-[0.05em] text-white [paint-order:stroke_fill]"
              style={{
                textShadow: TITLE_SHADOW,
                WebkitTextStroke: '0.65px rgba(0,0,0,0.45)',
              }}
            >
              SPIELTAG
            </h2>
            <p className="text-[7px] font-bold uppercase tracking-[0.28em] text-red-200/88 sm:text-[8px] sm:tracking-[0.32em]">
              MORGEN IST SPIELTAG
            </p>
            <div
              className="mx-auto mt-0.5 h-[3px] w-[min(82%,13rem)] rounded-full opacity-95"
              style={{
                background:
                  'linear-gradient(90deg, transparent 0%, rgba(127,29,29,0.35) 8%, rgba(220,38,38,0.85) 50%, rgba(127,29,29,0.35) 92%, transparent 100%)',
                boxShadow: '0 0 14px rgba(220,38,38,0.45)',
              }}
              aria-hidden
            />
            <div className="flex justify-center pt-0.5">
              <span className="inline-flex max-w-[94%] items-center justify-center rounded-full border border-red-500/24 bg-black/30 px-2 py-0.5 text-[6px] font-bold uppercase tracking-[0.14em] text-white/80 sm:text-[7px]">
                Meisterschaftsspiel
              </span>
            </div>
          </div>

          <div className="flex w-full shrink-0 items-center justify-between gap-0 pr-[8%]">
            <div className="flex min-w-0 flex-1 flex-col items-center gap-1">
              <PosterLogo src={homeLogo} alt={HOME_TEAM} />
              <FeedClubName fullName={HOME_TEAM} variant="posterArtwork" className="w-full px-0.5" />
            </div>

            <div className="relative flex shrink-0 flex-col items-center justify-center self-stretch px-1">
              <div
                className="pointer-events-none absolute inset-y-1 left-1/2 z-0 w-[3px] -translate-x-1/2"
                style={{ background: VS_LIGHTNING, boxShadow: '0 0 24px rgba(220,38,38,0.65)' }}
                aria-hidden
              />
              <div className="relative z-[1] flex flex-col items-center">
                <VsLightningDivider />
                <span
                  className="my-0.5 text-lg font-extrabold uppercase tracking-[0.06em] text-white sm:my-1 sm:text-xl"
                  style={{
                    textShadow:
                      '0 0 18px rgba(255,255,255,0.18), 0 0 28px rgba(220,38,38,0.55), 0 3px 16px rgba(0,0,0,0.75)',
                  }}
                >
                  VS
                </span>
                <VsLightningDivider />
              </div>
            </div>

            <div className="flex min-w-0 flex-1 flex-col items-center gap-1">
              <PosterLogo src={awayLogo} alt={AWAY_TEAM} />
              <FeedClubName fullName={AWAY_TEAM} variant="posterArtwork" className="w-full px-0.5" />
            </div>
          </div>

          <div className="w-full shrink-0 pr-[10%]">
            <div className="mb-1 flex items-center justify-center gap-1.5">
              <Clock className="h-3 w-3 text-red-400/95" strokeWidth={2.5} aria-hidden />
              <p className="text-[9px] font-bold uppercase tracking-[0.24em] text-red-100/95 sm:text-[10px]">
                Anpfiff
              </p>
            </div>
            <div className="flex items-baseline justify-center gap-1">
              <span
                className="text-[clamp(2.2rem,13.8vw,3.2rem)] font-extrabold tabular-nums leading-none tracking-tight text-white"
                style={{ textShadow: KICKOFF_SHADOW }}
              >
                {kickoffMain}
              </span>
              <span className="text-[0.34em] font-black uppercase tracking-[0.16em] text-white/78">
                Uhr
              </span>
            </div>
          </div>

          <div className="w-full shrink-0 pr-[12%]">
            <div className="grid w-full grid-cols-2 gap-x-2 gap-y-1 px-0.5">
              <MetaColumn icon={Clock} label="Treffpunkt" value={MEETING} align="left" />
              <MetaColumn icon={MapPin} label="Ort" value={VENUE} align="right" />
            </div>

            <div className="mt-3 max-w-full px-1 pb-0.5 sm:mt-3.5">
              <span
                className="relative inline-block max-w-full break-words text-[14px] font-black uppercase tracking-[0.18em] text-red-400 sm:text-[16px] sm:tracking-[0.22em]"
                style={{
                  textShadow:
                    '0 0 34px rgba(220,38,38,0.62), 0 0 16px rgba(248,113,113,0.42), 0 2px 14px rgba(0,0,0,0.55)',
                }}
              >
                #GEMEINSAMEINTEAM
                <span
                  className="absolute -bottom-1.5 left-[4%] right-[4%] h-[3px] rounded-full"
                  style={{
                    background:
                      'linear-gradient(90deg, transparent 0%, rgba(127,29,29,0.4) 6%, rgba(248,113,113,0.95) 50%, rgba(127,29,29,0.4) 94%, transparent 100%)',
                    boxShadow: '0 0 16px rgba(220,38,38,0.55), 0 2px 8px rgba(185,28,28,0.35)',
                  }}
                  aria-hidden
                />
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  },
);

PlayerMatchdayPosterArtwork.displayName = 'PlayerMatchdayPosterArtwork';
