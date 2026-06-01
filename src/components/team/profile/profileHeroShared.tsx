import React from "react";
import {
  preloadProfileHeroImage,
  resolveProfileCutoutSrc,
  resolveProfilePhotoSrc,
} from "../../../lib/profileHeroImage";
import {
  PROFILE_HERO_STADIUM_BG,
  preloadProfileHeroStadiumBackground,
  probeProfileHeroStadiumBackground,
} from "../../../lib/profileHeroStadiumBg";
import { getLogoUrl } from "../../../utils/logoResolver";

export const HERO_CARD_CLASS =
  "relative mb-3 aspect-[1.55/1] min-h-[15rem] max-h-[16.875rem] w-full overflow-hidden rounded-[22px] border border-[#E50914]/55 bg-[#050505] shadow-[0_0_28px_rgba(229,9,20,0.16),0_12px_40px_rgba(0,0,0,0.58)] ring-1 ring-[#E50914]/20 sm:min-h-[16rem] sm:max-h-[18rem]";

/** Originales NSG-Gölsental-Logo für Hero-Wasserzeichen (public/logos). */
export const PROFILE_HERO_WATERMARK_LOGO = getLogoUrl("nsg-goelsental");

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

export function useProfileHeroImagePreload(cutoutUrl?: string | null, photoUrl?: string | null): void {
  React.useEffect(() => {
    preloadProfileHeroImage(cutoutUrl);
    preloadProfileHeroImage(photoUrl);
  }, [cutoutUrl, photoUrl]);
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
      <div className="absolute inset-x-0 top-[16%] h-px bg-white/[0.07]" />
      <div className="absolute inset-x-0 top-[36%] h-px bg-white/[0.05]" />
      <div className="absolute inset-y-0 right-0 w-[64%] bg-[radial-gradient(ellipse_100%_90%_at_100%_36%,rgba(229,9,20,0.48)_0%,rgba(139,13,18,0.22)_34%,transparent_68%)]" />
      <div className="absolute bottom-0 right-0 h-[94%] w-[54%] bg-[radial-gradient(ellipse_74%_64%_at_90%_94%,rgba(229,9,20,0.32)_0%,transparent_64%)] blur-sm" />
      <div className="absolute -right-8 top-[4%] h-[60%] w-[48%] rotate-[-11deg] bg-[linear-gradient(135deg,rgba(229,9,20,0.24)_0%,transparent_56%)] blur-md" />
      <div className="absolute right-[2%] top-[12%] h-[44%] w-[34%] rounded-full bg-[radial-gradient(circle,rgba(229,9,20,0.2)_0%,transparent_68%)] blur-xl" />
      <div className="absolute right-[8%] top-[28%] h-3 w-4 rotate-[20deg] rounded-full bg-[#E50914]/30 blur-[2px]" />
      <div className="absolute right-[16%] top-[44%] h-3.5 w-5 rotate-[-14deg] rounded-full bg-[#E50914]/24 blur-sm" />
      <div className="absolute right-[5%] top-[54%] h-2 w-2.5 rotate-[10deg] rounded-full bg-[#E50914]/35 blur-[1px]" />
      <div className="absolute right-[20%] top-[18%] h-5 w-7 rotate-[-24deg] rounded-full bg-[#8B0D12]/22 blur-md" />
      <div className="absolute right-[12%] top-[62%] h-2 w-3 rotate-[6deg] rounded-full bg-[#E50914]/28 blur-[1px]" />
      <div className="opacity-[0.5]">
        <div className="absolute -left-6 top-0 h-[84%] w-[40%] origin-top-left -skew-x-[5deg] bg-[linear-gradient(168deg,rgba(255,252,248,0.36)_0%,transparent_64%)] blur-[1px]" />
        <div className="absolute right-0 top-0 h-[86%] w-[44%] origin-top-right skew-x-[5deg] bg-[linear-gradient(195deg,rgba(255,252,248,0.34)_0%,transparent_60%)] blur-[1px]" />
        <div className="absolute left-[26%] top-0 h-32 w-32 rounded-full bg-white/[0.18] blur-3xl" />
        <div className="absolute right-[12%] top-0 h-28 w-28 rounded-full bg-white/[0.16] blur-2xl" />
        <div className="absolute left-1/2 top-0 h-24 w-36 -translate-x-1/2 rounded-full bg-white/[0.12] blur-3xl" />
      </div>
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_108%_98%_at_50%_34%,transparent_30%,rgba(0,0,0,0.32)_76%,rgba(0,0,0,0.82)_100%)]" />
      <div className="absolute inset-x-0 bottom-0 h-[42%] bg-[linear-gradient(180deg,transparent_0%,rgba(0,0,0,0.62)_100%)]" />
    </div>
  );
}

export function HeroClubLogoWatermark() {
  const [failed, setFailed] = React.useState(false);
  if (failed) return null;

  return (
    <div
      className="pointer-events-none absolute right-1 top-1 z-[1] h-[7.5rem] w-[7.5rem] opacity-[0.15] sm:right-1.5 sm:top-1.5 sm:h-[8.75rem] sm:w-[8.75rem] sm:opacity-[0.17]"
      aria-hidden
    >
      <img
        src={PROFILE_HERO_WATERMARK_LOGO}
        alt=""
        className="h-full w-full object-contain object-right-top"
        onError={() => setFailed(true)}
      />
    </div>
  );
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
  const opacity = isPlayer ? 0.36 : 0.34;
  const texture = isPlayer ? MARK_TEXTURE_PLAYER : MARK_TEXTURE_TRAINER;

  return (
    <div
      className="pointer-events-none relative z-[1] -ml-1 select-none font-black leading-[0.8] tracking-[-0.05em]"
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
          WebkitTextStroke: "1.5px rgba(255,255,255,0.2)",
          paintOrder: "stroke fill",
          textShadow: "0 4px 32px rgba(0,0,0,0.5), 0 0 48px rgba(255,255,255,0.1)",
          WebkitMaskImage: "linear-gradient(180deg, black 0%, black 72%, rgba(0,0,0,0.3) 100%)",
          maskImage: "linear-gradient(180deg, black 0%, black 72%, rgba(0,0,0,0.3) 100%)",
        }}
      >
        {mark}
      </span>
    </div>
  );
}

export function HeroTeamHeaderLine({ teamLine }: { teamLine: string }) {
  const { ageGroup, club } = splitPlayerTeamHeader(teamLine);
  return (
    <p className="text-[10px] font-extrabold uppercase leading-tight tracking-[0.1em] sm:text-[11px]">
      {ageGroup ? (
        <>
          <span className="text-[#E50914]">{ageGroup}</span>
          <span className="text-white/90"> </span>
        </>
      ) : null}
      <span className="text-white/88">{club || teamLine.toUpperCase()}</span>
      <span className="text-[#E50914]/80"> ////</span>
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
}: {
  photoUrl?: string | null;
  initials: string;
  visible: boolean;
}) {
  const photoSrc = resolveProfilePhotoSrc(photoUrl);
  const [photoFailed, setPhotoFailed] = React.useState(false);
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
    "absolute bottom-0 right-[-10%] h-[152%] w-auto max-h-none max-w-[78%] object-contain object-right-bottom sm:max-w-[74%]",
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
  const glowClass =
    variant === "player"
      ? "absolute bottom-[1%] right-[-2%] h-[66%] w-[52%] bg-[radial-gradient(ellipse_at_center,rgba(229,9,20,0.26)_0%,transparent_72%)] blur-2xl"
      : "absolute bottom-[2%] right-[2%] h-[58%] w-[44%] bg-[radial-gradient(ellipse_at_center,rgba(229,9,20,0.2)_0%,transparent_72%)] blur-2xl";
  const rimClass =
    variant === "player"
      ? "absolute bottom-[5%] right-[-2%] h-[62%] w-[52%] bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.18)_0%,transparent_70%)] blur-2xl"
      : "absolute bottom-[6%] right-[2%] h-[54%] w-[44%] bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.14)_0%,transparent_70%)] blur-2xl";

  React.useEffect(() => {
    setLoaded(false);
  }, [cutoutSrc]);

  return (
    <div
      className={`pointer-events-none absolute inset-x-0 bottom-0 top-0 z-[3] transition-opacity duration-300 ${
        visible && loaded ? "opacity-100" : "opacity-0"
      }`}
      aria-hidden
    >
      <div className={glowClass} aria-hidden />
      <div className={rimClass} aria-hidden />
      <img
        src={cutoutSrc}
        alt=""
        className={CUTOUT_IMG_CLASS[variant]}
        style={{
          filter:
            "drop-shadow(0 8px 36px rgba(0,0,0,0.65)) drop-shadow(0 0 32px rgba(255,255,255,0.16)) drop-shadow(-10px 0 28px rgba(229,9,20,0.14))",
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

export { hasCutoutUrl, profileHeroLayoutMode, resolveProfileCutoutSrc } from "../../../lib/profileHeroImage";
