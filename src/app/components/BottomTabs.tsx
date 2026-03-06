import React from 'react';
import { NavLink } from 'react-router-dom';
import { CircleDot, Grid3X3, Play, Users, BarChart3 } from 'lucide-react';

function NavItem({
  to,
  end,
  icon,
  label,
}: {
  to: string;
  end?: boolean;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        `flex flex-col items-center text-xs transition-all ${
          isActive ? 'text-white' : 'text-white/60'
        }`
      }
    >
      {({ isActive }) => (
        <>
          <div
            className={`rounded-xl p-3 transition-all ${
              isActive ? 'bg-red-600 shadow-lg' : ''
            }`}
          >
            {icon}
          </div>
          <span className="mt-1">{label}</span>
        </>
      )}
    </NavLink>
  );
}

export const BottomTabs: React.FC = () => {
  return (
    <nav
      className="fixed bottom-0 left-0 z-50 w-full border-t border-white/10 bg-black/60 backdrop-blur-lg"
      aria-label="Hauptnavigation"
    >
      <div className="mx-auto flex max-w-[560px] justify-between px-6 py-3">
        <NavItem to="/" end label="Home" icon={<CircleDot size={24} />} />
        <NavItem to="/schedule" label="Spielplan" icon={<Grid3X3 size={24} />} />
        <NavItem to="/live" label="Live" icon={<Play size={24} />} />
        <NavItem to="/team" label="Team" icon={<Users size={24} />} />
        <NavItem to="/table" label="Tabelle" icon={<BarChart3 size={24} />} />
      </div>
    </nav>
  );
};
