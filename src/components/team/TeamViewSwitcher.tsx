import { ClubLogo } from "../branding/ClubLogo";
import React, { useState } from 'react';
import { Check, Users } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useSession } from '../../auth/useSession';
import { Modal } from '../../app/ui/Modal';
import { getClubLogo } from '../../lib/teamLogos';
import { ensureFanTeamAccess } from '../../lib/teamFavorites';
import { useHiddenTeamFavoriteIds, useSavedTeamFavorites } from '../../hooks/useSavedTeamFavorites';

/** One picker for membership teams and saved read-only favorites. */
export function TeamViewSwitcher() {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const { user, teamSeasons, selectedTeamSeasonId, viewTeamSeasonId, setViewTeamSeasonId, setSelectedTeamSeasonId } = useSession();
  const favorites = useSavedTeamFavorites();
  const hiddenIds = useHiddenTeamFavoriteIds();
  const teams = [
    ...teamSeasons.filter(ts => ts.status !== 'archived' && !hiddenIds.includes(ts.id)).map(ts => ({ id: ts.id, name: ts.team?.name || ts.display_name || 'Team', ageGroup: ts.age_group, season: ts.season?.name, logo: getClubLogo(ts.team?.name || '', { teamId: ts.team?.id, logoUrl: ts.team?.logo_url }), own: true })),
    ...favorites.filter(team => !teamSeasons.some(own => own.id === team.id)).map(team => ({ ...team, own: false })),
  ];
  return <>
    <button type="button" onClick={() => setOpen(true)} aria-label="Mannschaft wechseln" title="Mannschaft wechseln" aria-haspopup="dialog" aria-expanded={open}
      className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/20 bg-black/65 text-[rgb(var(--club-accent-text-rgb))] shadow-lg backdrop-blur-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--club-accent-rgb))]">
      <Users className="h-5 w-5" aria-hidden />
    </button>
    <Modal isOpen={open} title="Mannschaft wechseln" onClose={() => setOpen(false)}>
      <div className="space-y-2">
        {error ? <p role="alert" className="text-sm text-red-300">{error}</p> : null}
        {teams.map(team => {
          const selected = team.id === (viewTeamSeasonId ?? selectedTeamSeasonId);
          return <button key={team.id} type="button" aria-pressed={selected} disabled={busy} onClick={async () => {
            setError(null);
            if (!team.own) {
              if (!user?.id) return;
              setBusy(true);
              const failure = await ensureFanTeamAccess(user.id, team.id);
              setBusy(false);
              if (failure) { setError(failure); return; }
            }
            if (team.own) setSelectedTeamSeasonId(team.id); else setViewTeamSeasonId(team.id);
            setOpen(false); navigate(`/app/team?teamSeason=${encodeURIComponent(team.id)}`);
          }} className={`flex min-h-[76px] w-full items-center gap-3 rounded-2xl border px-3 py-3 text-left ${selected ? 'border-[rgb(var(--club-border-rgb)/0.7)] bg-[rgb(var(--club-primary-rgb)/0.22)]' : 'border-white/15 bg-white/[0.035]'}`}>
            {team.logo ? <ClubLogo src={team.logo} alt="" className="h-10 w-10 object-contain" /> : <Users className="h-10 w-10 text-white/50" aria-hidden />}
            <span className="min-w-0 flex-1"><span className="block text-sm font-bold text-white">{team.name} · {team.ageGroup}</span><span className="text-xs text-white/60">{team.season}{!team.own ? ' · Favorit' : ''}</span></span>
            {selected ? <Check className="h-5 w-5 text-[rgb(var(--club-accent-text-rgb))]" aria-hidden /> : null}
          </button>;
        })}
      </div>
    </Modal>
  </>;
}
