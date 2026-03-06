import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useSession } from '../../auth/useSession';
import { useAuth } from '../../auth/AuthProvider';

const logo = import.meta.env.BASE_URL + 'logos/nsg-goelsental.png';

/** Deutsche Anzeige für Rolle (nur sichtbar wenn Rolle vorhanden). */
const ROLE_LABEL_DE: Record<string, string> = {
  admin: 'Admin',
  trainer: 'Trainer',
  parent: 'Eltern',
  player: 'Spieler',
  fan: 'Fan',
};

export const Header: React.FC = () => {
  const navigate = useNavigate();
  const { membershipError, effectiveRole, loading: sessionLoading } = useSession();
  const { user, loading: authLoading } = useAuth();
  const roleLabel = effectiveRole ? (ROLE_LABEL_DE[effectiveRole] ?? effectiveRole) : null;

  return (
    <header className="fixed left-0 top-0 z-50 w-full border-b border-white/10 bg-black/60 py-3 backdrop-blur-md">
      <div className="mx-auto flex h-16 w-full max-w-screen-2xl items-center justify-between gap-2 px-4 md:px-8">
        {/* Links: Logo + Branding */}
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <img
            src={logo}
            alt=""
            className="h-9 w-9 shrink-0 rounded-full object-cover"
            width={36}
            height={36}
          />
          <div className="min-w-0">
            <div className="text-lg font-semibold leading-tight text-white">
              SpielzeitApp
            </div>
            <div className="text-xs text-white/60">
              NSG Gölsental
            </div>
            {membershipError && (
              <span className="text-xs text-amber-400" role="alert">
                {membershipError}
              </span>
            )}
          </div>
        </div>

        {/* Rechts: Profil + Role-Badge (darunter) */}
        <div className="flex shrink-0 flex-col items-end justify-center gap-1">
          <div className="flex items-center gap-2">
            {!authLoading && !user && (
              <button
                type="button"
                onClick={() => navigate('/login')}
                className="rounded-full border border-white/10 bg-white/10 px-3 py-2 text-xs text-white transition-colors hover:bg-white/15 hover:text-white"
              >
                Login
              </button>
            )}
            <Link
              to="/profile"
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/10 bg-white/10 text-white transition-colors hover:bg-white/15 hover:text-white focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2 focus:ring-offset-black"
              aria-label="Profil"
            >
              <svg
                viewBox="0 0 24 24"
                className="h-5 w-5"
                stroke="currentColor"
                strokeWidth="1.8"
                fill="none"
                aria-hidden
              >
                <path
                  d="M12 12a4 4 0 1 0-4-4 4 4 0 0 0 4 4zm0 2c-4 0-7 2-7 4.5V20h14v-1.5C19 16 16 14 12 14z"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </Link>
          </div>
          {roleLabel && !sessionLoading && !authLoading && (
            <span className="rounded-full bg-red-600/80 px-2 py-0.5 text-[11px] font-medium text-white">
              {roleLabel}
            </span>
          )}
        </div>
      </div>
    </header>
  );
};
