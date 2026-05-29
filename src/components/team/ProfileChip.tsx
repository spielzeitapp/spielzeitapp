import React from "react";

export function ProfileChip({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full border border-red-500/30 bg-red-500/[0.12] px-2.5 py-1 text-[12px] font-semibold text-white/90 shadow-[0_0_16px_rgba(220,38,38,0.12)] sm:px-3">
      {children}
    </span>
  );
}
