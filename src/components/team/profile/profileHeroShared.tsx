import React from "react";
import {
  hasCutoutUrl,
  preloadProfileHeroImage,
  profileHeroLayoutMode,
  resolveProfileCutoutSrc,
  resolveProfileHeroImageSrc,
  resolveProfilePhotoSrc,
} from "../../../lib/profileHeroImage";
import {
  PROFILE_HERO_STADIUM_BG,
  preloadProfileHeroStadiumBackground,
  probeProfileHeroStadiumBackground,
} from "../../../lib/profileHeroStadiumBg";

export const HERO_CARD_CLASS =
  "relative mb-3 aspect-[1.55/1] min-h-[15rem] max-h-[16.875rem] w-full overflow-hidden rounded-[22px] border border-[#E50914]/55 bg-[#050505] shadow-[0_0_28px_rgba(229,9,20,0.16),0_12px_40px_rgba(0,0,0,0.58)] sm:min-h-[16rem] sm:max-h-[18rem]";

if (typeof window !== "undefined") {
  preloadProfileHeroStadiumBackground();
}

export function splitTeamSeasonLabel(label: string): { team: string; season: string } {
  const parts = label
    .split("·")
    .map((s) => s.trim())
    .filter(Boolean);
  if (parts.length >= 2) {
    return { team: parts[0], season: parts.slice(1).join(" · ") };
  }
  return { team: label.trim(), season: "" };
}

export function splitPlayerTeamHeader(teamLine: string): { ageGroup: string; club: string } {
  const trimmed = teamLine.trim();
  if (!trimmed) return { ageGroup: "", club: "" };
  const parts = trimmed.split(/\s+/);
  if (parts.length >= 2 && /^U\d+/i.test(parts[0])) {
    return {
      ageGroup: parts[0].toUpperCase(),
      club: parts.slice(1).join(" ").toUpperCase(),
    };
  }
  return { ageGroup: "", club: trimmed.toUpperCase() };
}

export function useStadiumBackgroundUrl(): string {
  const [url, setUrl] = React.useState(PROFILE_HERO_STADIUM_BG);
  React.useEffect(() => {
    probeProfileHeroStadiumBackground((resolved) => {
      if (resolved) setUrl(resolved);
    });
  }, []);
  return url;
}

export function useProfileHeroImagePreload(
  cutoutUrl?: string | null,
  photoUrl?: string | null,
  cacheKey?: string | null
): void {
  React.useEffect(() => {
    const cutout = resolveProfileHeroImageSrc(
      hasCutoutUrl(cutoutUrl) ? resolveProfileCutoutSrc(cutoutUrl) : null,
      cacheKey
    );
    const photo = resolveProfileHeroImageSrc(resolveProfilePhotoSrc(photoUrl), cacheKey);
    preloadProfileHeroImage(cutout);
    preloadProfileHeroImage(photo);
  }, [cutoutUrl, photoUrl, cacheKey]);
}

export function PremiumHeroStadiumAtmosphere({ photoBgUrl }: { photoBgUrl: string }) {
  return (
    <div className="pointer-events-none absolute inset-0 z-0" aria-hidden>
      <div
        className="absolute inset-0 bg-cover bg-center bg-no-repeat saturate-[0.88] brightness-[0.64] contrast-[1.22]"
        style={{
          backgroundImage: `url(${photoBgUrl})`,
          backgroundSize: "cover",
          backgroundPosition: "center 30%",
        }}
      />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.18)_0%,rgba(0,0,0,0.44)_50%,rgba(0,0,0,0.86)_100%)]" />
      <div className="absolute inset-y-0 right-0 w-[64%] bg-[radial-gradient(ellipse_100%_90%_at_100%_36%,rgba(229,9,20,0.48)_0%,rgba(139,13,18,0.22)_34%,transparent_68%)]" />
      <div className="absolute bottom-0 right-0 h-[94%] w-[54%] bg-[radial-gradient(ellipse_74%_64%_at_90%_94%,rgba(229,9,20,0.32)_0%,transparent_64%)] blur-sm" />
      <div className="absolute -right-8 top-[4%] h-[60%] w-[48%] rotate-[-11deg] bg-[linear-gradient(135deg,rgba(229,9,20,0.24)_0%,transparent_56%)] blur-md" />
      <div className="absolute right-[2%] top-[12%] h-[44%] w-[34%] rounded-full bg-[radial-gradient(circle,rgba(229,9,20,0.2)_0%,transparent_68%)] blur-xl" />
      <div className="absolute right-[8%] top-[28%] h-3 w-4 rotate-[20deg] rounded-full bg-[#E50914]/30 blur-[2px]" />
      <div className="absolute right-[16%] top-[44%] h-3.5 w-5 rotate-[-14deg] rounded-full bg-[#E50914]/24 blur-sm" />
      <div className="absolute right-[5%] top-[54%] h-2 w-2.5 rotate-[10deg] rounded-full bg-[#E50914]/35 blur-[1px]" />
      <div className="opacity-[0.32]">
        <div className="absolute right-0 top-0 h-[86%] w-[44%] origin-top-right skew-x-[5deg] bg-[linear-gradient(195deg,rgba(255,252,248,0.3)_0%,transparent_60%)] blur-[1px]" />
        <div className="absolute right-[12%] top-0 h-24 w-24 rounded-full bg-white/[0.1] blur-xl" />
      </div>
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_108%_98%_at_50%_34%,transparent_30%,rgba(0,0,0,0.32)_76%,rgba(0,0,0,0.82)_100%)]" />
      <div className="absolute inset-x-0 bottom-0 h-[42%] bg-[linear-gradient(180deg,transparent_0%,rgba(0,0,0,0.62)_100%)]" />
    </div>
  );
}

export function HeroClubLogoWatermark() {
  return null;
}

const MARK_TEXTURE_PLAYER =
  "linear-gradient(168deg, rgba(255,255,255,0.98) 0%, rgba(235,235,235,0.72) 22%, rgba(255,255,255,0.95) 44%, rgba(200,200,200,0.58) 62%, rgba(255,255,255,0.9) 82%, rgba(220,220,220,0.65) 100%)";

const MARK_TEXTURE_TRAINER =
  "linear-gradient(168deg, rgba(255,255,255,0.96) 0%, rgba(225,225,225,0.68) 24%, rgba(255,255,255,0.92) 46%, rgba(195,195,195,0.52) 66%, rgba(255,255,255,0.88) 100%)";

export function HeroPrimaryMark({
  mark,
  variant = "trainer",
}: {
  mark: string;
  variant?: "trainer" | "player";
}) {
  const isPlayer = variant === "player";
  const opacity = isPlayer ? 0.34 : 0.32;
  const texture = isPlayer ? MARK_TEXTURE_PLAYER : MARK_TEXTURE_TRAINER;

  return (
    <div
      className="pointer-events-none relative z-[2] -ml-1 select-none font-black leading-[0.8] tracking-[-0.05em]"
      style={{
        fontSize: "clamp(7.25rem, 36vw, 10.5rem)",
        opacity,
      }}
      aria-hidden
    >
      <span
        className="relative inline-block"
        style={{
          color: "transparent",
          backgroundImage: texture,
          WebkitBackgroundClip: "text",
          backgroundClip: "text",
          WebkitTextStroke: "1.5px rgba(255,255,255,0.22)",
          paintOrder: "stroke fill",
          textShadow: "0 2px 16px rgba(0,0,0,0.6)",
          WebkitMaskImage: "linear-gradient(180deg, black 0%, black 74%, rgba(0,0,0,0.32) 100%)",
          maskImage: "linear-gradient(180deg, black 0%, black 74%, rgba(0,0,0,0.32) 100%)",
        }}
      >
        {mark}
      </span>
    </div>
  );
}

export function HeroTeamHeaderLine({ teamLine }: { teamLine: string }) {
  const { ageGroup, club } = splitPlayerTeamHeader(teamLine);
  const clubText = (club || teamLine.toUpperCase()).trim();

  return (
    <p className="flex min-w-0 max-w-full items-baseline overflow-hidden whitespace-nowrap text-[9px] font-extrabold uppercase leading-none tracking-[0.07em] sm:text-[10px] sm:tracking-[0.09em]">
      {ageGroup ? <span className="shrink-0 text-[#E50914]">{ageGroup}&nbsp;</span> : null}
      <span className="min-w-0 truncate text-white/88">{clubText}</span>
      <span className="shrink-0 text-[#E50914]/85">&nbsp;////</span>
    </p>
  );
}

export function HeroRoleLabel({ children }: { children: string }) {
  return (
    <p className="text-[11px] font-extrabold uppercase italic tracking-[0.12em] text-[#E50914] sm:text-[12px]">
      {children}
    </p>
  );
}

export function HeroNameBlock({
  firstNameLine,
  lastNameLine,
}: {
  firstNameLine: string;
  lastNameLine: string;
}) {
  const nameClass =
    "font-black uppercase leading-[0.9] tracking-tight text-white [text-shadow:0_2px_18px_rgba(0,0,0,0.9)] text-[clamp(1.05rem,4.2vw,1.55rem)]";
  return (
    <div className="mt-auto pb-0.5 pt-1.5">
      {firstNameLine ? <p className={nameClass}>{firstNameLine}</p> : null}
      {lastNameLine ? <p className={nameClass}>{lastNameLine}</p> : null}
    </div>
  );
}

export function HeroSeasonLine({ seasonLine }: { seasonLine: string }) {
  const line = seasonLine.trim();
  if (!line) return null;
  return (
    <p className="pb-0.5 text-[10px] font-medium uppercase tracking-wide text-white/40">
      Saison {line}
    </p>
  );
}

export function HeroAvatarInSlot({
  photoUrl,
  initials,
  visible,
  imageCacheKey,
}: {
  photoUrl?: string | null;
  initials: string;
  visible: boolean;
  imageCacheKey?: string | null;
}) {
  const photoSrc = resolveProfileHeroImageSrc(resolveProfilePhotoSrc(photoUrl), imageCacheKey);
  const [photoFailed, setPhotoFailed] = React.useState(false);

  React.useEffect(() => {
    setPhotoFailed(false);
  }, [photoSrc]);

  const showPhoto = visible && Boolean(photoSrc) && !photoFailed;

  return (
    <div
      className={`absolute inset-0 flex items-end justify-end pb-0 pr-0 transition-opacity duration-300 ${
        visible ? "opacity-100" : "pointer-events-none opacity-0"
      }`}
    >
      <div className="relative h-[8.75rem] w-[8.75rem] overflow-hidden rounded-2xl border border-[#161616]/70 bg-[#0A0A0A]/85 sm:h-[9.25rem] sm:w-[9.25rem]">
        {showPhoto ? (
          <img
            key={photoSrc ?? "no-photo"}
            src={photoSrc!}
            alt=""
            className="h-full w-full object-cover object-top"
            onError={() => setPhotoFailed(true)}
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-zinc-900 text-lg font-black text-white">
            {initials}
          </div>
        )}
      </div>
    </div>
  );
}

const CUTOUT_IMG_CLASS = {
  player:
    "absolute bottom-0 right-[-10%] h-[168%] w-auto max-h-none max-w-[82%] object-contain object-[right_88%_bottom] sm:max-w-[78%]",
  trainer:
    "absolute bottom-0 right-[-6%] h-[128%] w-auto max-h-none max-w-[68%] object-contain object-right-bottom sm:max-w-[64%]",
} as const;

export function HeroCutoutLayer({
  cutoutSrc,
  visible,
  onLoad,
  onError,
  variant = "player",
}: {
  cutoutSrc: string;
  visible: boolean;
  onLoad: () => void;
  onError: () => void;
  variant?: "trainer" | "player";
}) {
  const [loaded, setLoaded] = React.useState(false);

  React.useEffect(() => {
    setLoaded(false);
  }, [cutoutSrc]);

  if (!visible || !cutoutSrc.trim()) return null;

  const playerStyle =
    variant === "player"
      ? {
          transform: "scale(1.06)",
          transformOrigin: "right bottom",
        }
      : undefined;

  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 top-0 z-[3]" aria-hidden>
      {variant === "player" ? (
        <div
          className="absolute bottom-[1%] right-[-2%] h-[66%] w-[52%] bg-[radial-gradient(ellipse_at_center,rgba(229,9,20,0.22)_0%,transparent_72%)] blur-xl"
          aria-hidden
        />
      ) : (
        <div
          className="absolute bottom-[2%] right-[2%] h-[58%] w-[44%] bg-[radial-gradient(ellipse_at_center,rgba(229,9,20,0.18)_0%,transparent_72%)] blur-xl"
          aria-hidden
        />
      )}
      <img
        key={cutoutSrc}
        src={cutoutSrc}
        alt=""
        className={`${CUTOUT_IMG_CLASS[variant]} transition-opacity duration-300 ${
          loaded ? "opacity-100" : "opacity-0"
        }`}
        style={{
          ...playerStyle,
          filter: "drop-shadow(0 8px 36px rgba(0,0,0,0.65)) drop-shadow(-8px 0 24px rgba(229,9,20,0.12))",
          maskImage: "linear-gradient(to bottom, black 0%, black 91%, transparent 100%)",
          WebkitMaskImage: "linear-gradient(to bottom, black 0%, black 91%, transparent 100%)",
        }}
        onLoad={() => {
          setLoaded(true);
          onLoad();
        }}
        onError={onError}
      />
    </div>
  );
}

export function useProfileHeroCutoutState(
  cutoutUrl: string | null | undefined,
  imageCacheKey?: string | null
) {
  const cutoutRaw = hasCutoutUrl(cutoutUrl) ? resolveProfileCutoutSrc(cutoutUrl) : null;
  const cutoutSrc = resolveProfileHeroImageSrc(cutoutRaw, imageCacheKey);
  const [cutoutFailed, setCutoutFailed] = React.useState(false);
  const [cutoutLoaded, setCutoutLoaded] = React.useState(false);

  React.useEffect(() => {
    setCutoutFailed(false);
    setCutoutLoaded(false);
  }, [cutoutSrc]);

  const isCutoutLayout = profileHeroLayoutMode(cutoutUrl) === "cutout";
  const showCutout =
    isCutoutLayout && Boolean(cutoutSrc) && !cutoutFailed && cutoutLoaded;
  const showAvatarFallback = !isCutoutLayout || !cutoutSrc || cutoutFailed || !cutoutLoaded;

  return {
    isCutoutLayout,
    cutoutSrc,
    showCutout,
    showAvatarFallback,
    onCutoutLoad: () => setCutoutLoaded(true),
    onCutoutError: () => {
      setCutoutFailed(true);
      setCutoutLoaded(false);
    },
  };
}

export { resolveProfileCutoutSrc } from "../../../lib/profileHeroImage";
