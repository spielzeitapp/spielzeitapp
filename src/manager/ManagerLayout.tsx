import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import { ManagerHeader } from './components/ManagerHeader';
import { ManagerSidebar } from './components/ManagerSidebar';
import { ManagerAccessGate } from './ManagerAccessGate';

/**
 * Shell für alle /manager-Seiten: dunkle Sidebar, heller Arbeitsbereich.
 */
export function ManagerLayout(): React.ReactElement {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <ManagerAccessGate>
      <div className="flex min-h-[100dvh] bg-[#F4F5F7] text-slate-900">
        <ManagerSidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
        <div className="flex min-w-0 flex-1 flex-col">
          <ManagerHeader onOpenSidebar={() => setSidebarOpen(true)} />
          <main className="min-h-0 flex-1 overflow-x-hidden overflow-y-auto">
            <div className="mx-auto w-full max-w-6xl px-3 py-5 sm:px-5 sm:py-6 lg:px-8">
              <Outlet />
            </div>
          </main>
        </div>
      </div>
    </ManagerAccessGate>
  );
}
