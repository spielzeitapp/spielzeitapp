import React from 'react';
import { Link } from 'react-router-dom';
import { SchedulePage } from '../../pages/SchedulePage';

export function ManagerMobileSchedulePage(): React.ReactElement {
  return (
    <div className="min-h-full bg-[#050506] px-2 pb-6 pt-2 text-white md:min-h-0 md:rounded-2xl md:bg-white md:px-4 md:py-5 md:text-slate-900">
      <div className="md:hidden"><SchedulePage managerSimpleMode /></div>
      <div className="hidden md:block">
        <h1 className="text-2xl font-semibold">Mobile Terminübersicht</h1>
        <p className="mt-2 text-sm text-slate-500">Am Desktop steht dir weiterhin der vollständige Manager zur Verfügung.</p>
        <Link to="/app/termine" className="mt-4 inline-flex rounded-lg bg-red-700 px-4 py-2 text-sm font-semibold text-white">Termine öffnen</Link>
      </div>
    </div>
  );
}
