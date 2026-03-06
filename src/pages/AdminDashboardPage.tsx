import React from 'react';
import { Link } from 'react-router-dom';

/**
 * Interner Admin-Bereich. Nur nach Login erreichbar (RequireAuth).
 */
export const AdminDashboardPage: React.FC = () => {
  return (
    <div className="page min-h-[50vh] px-4 py-8">
      <div className="mx-auto max-w-md space-y-6">
        <h1 className="text-xl font-semibold text-white">Admin Bereich</h1>
        <p className="text-sm text-white/70">
          Interne Verwaltung. Nur für berechtigte Nutzer.
        </p>
        <nav className="flex flex-col gap-3">
          <Link
            to="/admin/setup"
            className="rounded-xl border border-white/20 bg-white/5 px-4 py-3 text-white hover:bg-white/10"
          >
            Admin Setup
          </Link>
          <Link
            to="/admin/roles"
            className="rounded-xl border border-white/20 bg-white/5 px-4 py-3 text-white hover:bg-white/10"
          >
            Rollen verwalten
          </Link>
        </nav>
      </div>
    </div>
  );
};
