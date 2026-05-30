import React from "react";
import { ChevronLeft } from "lucide-react";

type Props = {
  title: string;
  titleId?: string;
  onBack: () => void;
  backLabel: string;
};

/** Kompakte Profil-Topbar — Hero rückt näher nach oben. */
export const ProfileCompactHeader: React.FC<Props> = ({ title, titleId, onBack, backLabel }) => (
  <div className="z-20 flex shrink-0 items-center gap-1 border-b border-white/[0.06] bg-black/95 px-1.5 py-1 pt-[max(0.35rem,env(safe-area-inset-top,0px))] backdrop-blur-sm">
    <button
      type="button"
      onClick={onBack}
      className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-white/85 transition-colors hover:bg-white/10"
      aria-label={backLabel}
    >
      <ChevronLeft className="h-5 w-5" strokeWidth={2.25} />
    </button>
    <h1
      id={titleId}
      className="min-w-0 flex-1 truncate text-center text-[13px] font-semibold tracking-tight text-white/88"
    >
      {title}
    </h1>
    <div className="w-8 shrink-0" aria-hidden />
  </div>
);
