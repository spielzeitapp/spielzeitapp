import React from "react";

export function ProfileChip({ children }: { children: React.ReactNode }) {
  return (
    <span className="sz-club-accent-chip inline-flex items-center rounded-full border px-2.5 py-1 text-[12px] font-semibold text-white/90 sm:px-3">
      {children}
    </span>
  );
}
