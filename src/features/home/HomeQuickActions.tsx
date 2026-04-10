import React from 'react';
import { Link } from 'react-router-dom';
import { CalendarDays, MessageSquare, Radio, Users } from 'lucide-react';

const cell =
  'flex min-h-[88px] flex-col items-center justify-center gap-2 rounded-2xl border border-white/[0.08] bg-[#141414] px-3 py-4 text-center text-sm font-semibold text-white transition-colors hover:border-red-500/35 hover:bg-[#1a1a1a] active:bg-[#222]';

export const HomeQuickActions: React.FC = () => {
  return (
    <section className="pt-2" aria-label="Schnellzugriff">
      <h2 className="mb-3 text-xs font-bold uppercase tracking-[0.2em] text-white/45">Schnellzugriff</h2>
      <div className="grid grid-cols-2 gap-3">
        <Link to="/app/nachrichten" className={cell}>
          <MessageSquare className="h-6 w-6 text-red-500" strokeWidth={2} aria-hidden />
          Nachrichten
        </Link>
        <Link to="/app/team" className={cell}>
          <Users className="h-6 w-6 text-red-500" strokeWidth={2} aria-hidden />
          Team
        </Link>
        <Link to="/app/termine" className={cell}>
          <CalendarDays className="h-6 w-6 text-red-500" strokeWidth={2} aria-hidden />
          Termine
        </Link>
        <Link to="/app/live" className={cell}>
          <Radio className="h-6 w-6 text-red-500" strokeWidth={2} aria-hidden />
          Live
        </Link>
      </div>
    </section>
  );
};
