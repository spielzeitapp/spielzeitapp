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
import { getClubLogo } from "../../../lib/teamLogos";

export const HERO_CARD_CLASS =
  "relative mb-3 aspect-[1.55/1] min-h-[15rem] max-h-[16.875rem] w-full overflow-hidden rounded-[22px] border border-[#E50914]/42 bg-[#0A0A0A] shadow-[inset_0_1px_0_rgba(255,255,255,0.07),0_10px_36px_rgba(0,0,0,0.55),0_0_52px_rgba(229,9,20,0.1)] sm:min-h-[16rem] sm:max-h-[18rem]";

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

export function useClubLogoUrl(teamName?: string | null): string | null {
  const name = (teamName ?? "").trim();
  if (!name) return null;
  return getClubLogo(name);
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
        className="absolute inset-0 bg-cover bg-center bg-no-repeat saturate-[0.82] brightness-[0.62] contrast-[1.18]"
        style={{
          backgroundImage: `url(${photoBgUrl})`,
          backgroundSize: "cover",
          backgroundPosition: "center 32%",
        }}
      />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(0,0,0,0.22)_0%,rgba(0,0,0,0.48)_52%,rgba(0,0,0,0.82)_100%)]" />
      <div className="absolute inset-x-0 top-[18%] h-px bg-white/[0.06]" />
      <div className="absolute inset-x-0 top-[38%] h-px bg-white/[0.04]" />
      <div className="absolute inset-y-0 right-0 w-[62%] bg-[radial-gradient(ellipse_98%_88%_at_100%_38%,rgba(229,9,20,0.42)_0%,rgba(139,13,18,0.2)_36%,transparent_70%)]" />
      <div className="absolute bottom-0 right-0 h-[92%] w-[52%] bg-[radial-gradient(ellipse_72%_62%_at_88%_92%,rgba(229,9,20,0.28)_0%,transparent_66%)] blur-sm" />
      <div className="absolute -right-6 top-[6%] h-[58%] w-[46%] rotate-[-10deg] bg-[linear-gradient(135deg,rgba(229,9,20,0.2)_0%,transparent_58%)] blur-md" />
      <div className="absolute right-[4%] top-[14%] h-[42%] w-[32%] rounded-full bg-[radial-gradient(circle,rgba(229,9,20,0.16)_0%,transparent_70%)] blur-xl" />
      <div className="absolute right-[10%] top-[32%] h-2.5 w-3.5 rotate-[18deg] rounded-full bg-[#E50914]/25 blur-[2px]" />
      <div className="absolute right-[18%] top-[48%] h-3 w-5 rotate-[-12deg] rounded-full bg-[#E50914]/20 blur-sm" />
      <div className="absolute right-[7%] top-[58%] h-1.5 w-2 rotate-[8deg] rounded-full bg-[#E50914]/30 blur-[1px]" />
      <div className="absolute right-[22%] top-[22%] h-4 w-6 rotate-[-22deg] rounded-full bg-[#8B0D12]/18 blur-md" />
      <div className="opacity-[0.44]">
        <div className="absolute -left-5 top-0 h-[82%] w-[38%] origin-top-left -skew-x-[5deg] bg-[linear-gradient(168deg,rgba(255,252,248,0.32)_0%,transparent_66%)] blur-[1px]" />
        <div className="absolute right-0 top-0 h-[84%] w-[42%] origin-top-right skew-x-[5deg] bg-[linear-gradient(195deg,rgba(255,252,248,0.3)_0%,transparent_62%)] blur-[1px]" />
        <div className="absolute left-[28%] top-0 h-28 w-28 rounded-full bg-white/[0.16] blur-3xl" />
        <div className="absolute right-[14%] top-0 h-24 w-24 rounded-full bg-white/[0.14] blur-2xl" />
        <div className="absolute left-1/2 top-0 h-20 w-32 -translate-x-1/2 rounded-full bg-white/[0.1] blur-3xl" />
      </div>
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_105%_95%_at_48%_36%,transparent_34%,rgba(0,0,0,0.28)_78%,rgba(0,0,0,0.76)_100%)]" />
      <div className="absolute inset-x-0 bottom-0 h-[40%] bg-[linear-gradient(180deg,transparent_0%,rgba(0,0,0,0.58)_100%)]" />
    </div>
  );
}

export function HeroClubLogoWatermark({ logoUrl }: { logoUrl: string | null }) {
  const [failed, setFailed] = React.useState(false);
  if (!logoUrl || failed) return null;

  return (
    <div
      className="pointer-events-none absolute right-2 top-1.5 z-[1] h-[4.375rem] w-[4.375rem] opacity-[0.18] sm:right-2.5 sm:top-2 sm:h-[5.25rem] sm:w-[5.25rem] sm:opacity-[0.2]"
      aria-hidden
    >
      <img
        src={logoUrl}
        alt=""
        className="h-full w-full object-contain object-right-top brightness-[1.75] contrast-[0.75] grayscale invert drop-shadow-[0_2px_12px_rgba(0,0,0,0.35)]"
        onError={() => setFailed(true)}
      />
    </div>
  );
}

const MARK_TEXTURE =
  "linear-gradient(168deg, rgba(255,255,255,0.95) 0%, rgba(215,215,215,0.55) 28%, rgba(255,255,255,0.88) 48%, rgba(190,190,190,0.42) 68%, rgba(255,255,255,0.78) 100%)";

export function HeroPrimaryMark({
  mark,
  variant = "trainer",
}: {
  mark: string;
  variant?: "trainer" | "player";
}) {
  const opacity = variant === "player" ? 0.28 : 0.24;

  return (
    <div
      className="pointer-events-none relative z-[1] -ml-0.5 select-none font-black leading-[0.82] tracking-[-0.05em]"
      style={{
        fontSize: "clamp(7rem, 34vw, 10.125rem)",
        opacity,
      }}
      aria-hidden
    >
      <span
        className="relative inline-block"
        style={{
          color: "transparent",
          backgroundImage: MARK_TEXTURE,
          WebkitBackgroundClip: "text",
          backgroundClip: "text",
          WebkitTextStroke: "1px rgba(255,255,255,0.14)",
          paintOrder: "stroke fill",
          textShadow: "0 4px 28px rgba(0,0,0,0.55), 0 0 40px rgba(255,255,255,0.06)",
          WebkitMaskImage: "linear-gradient(180deg, black 0%, black 74%, rgba(0,0,0,0.35) 100%)",
          maskImage: "linear-gradient(180deg, black 0%, black 74%, rgba(0,0,0,0.35) 100%)",
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

export function HeroNameBlock({
  firstNameLine,
  lastNameLine,
}: {
  firstNameLine: string;
  lastNameLine: string;
}) {
  const nameClass =
    "font-black uppercase leading-[0.9] tracking-tight text-white [text-shadow:0_2px_16px_rgba(0,0,0,0.85)] text-[clamp(1.05rem,4.2vw,1.55rem)]";
  return (
    <div className="mt-auto pb-1 pt-2">
      {firstNameLine ? <p className={nameClass}>{firstNameLine}</p> : null}
      {lastNameLine ? <p className={nameClass}>{lastNameLine}</p> : null}
    </div>
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
    "absolute bottom-0 right-[-8%] h-[138%] w-auto max-h-none max-w-[74%] object-contain object-right-bottom sm:max-w-[70%]",
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
      ? "absolute bottom-[2%] right-0 h-[62%] w-[48%] bg-[radial-gradient(ellipse_at_center,rgba(229,9,20,0.22)_0%,transparent_72%)] blur-2xl"
      : "absolute bottom-[2%] right-[2%] h-[58%] w-[44%] bg-[radial-gradient(ellipse_at_center,rgba(229,9,20,0.2)_0%,transparent_72%)] blur-2xl";
  const rimClass =
    variant === "player"
      ? "absolute bottom-[6%] right-0 h-[58%] w-[48%] bg-[radial-gradient(ellipse_at_center,rgba(255,255,255,0.16)_0%,transparent_70%)] blur-2xl"
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
            "drop-shadow(0 6px 32px rgba(0,0,0,0.6)) drop-shadow(0 0 28px rgba(255,255,255,0.14)) drop-shadow(-8px 0 24px rgba(229,9,20,0.12))",
          maskImage: "linear-gradient(to bottom, black 0%, black 90%, transparent 100%)",
          WebkitMaskImage: "linear-gradient(to bottom, black 0%, black 90%, transparent 100%)",
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
