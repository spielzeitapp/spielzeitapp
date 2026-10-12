import React from 'react';

/** Reuses existing team tools inside the persistent Manager navigation. */
export function ManagerAppWorkspace({ children }: { children: React.ReactNode }): React.ReactElement {
  return <div className="manager-app-workspace manager-desktop-light min-w-0 overflow-hidden rounded-2xl bg-[#08080b] p-3 text-white sm:p-5">{children}</div>;
}
