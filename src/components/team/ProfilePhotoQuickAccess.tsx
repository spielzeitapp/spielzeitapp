import React, { lazy, Suspense, useEffect, useState } from 'react';
import { Camera } from 'lucide-react';
import { Modal } from '../../app/ui/Modal';
import { listRoster, type RosterPlayer } from '../../lib/rosterService';
import { fetchTeamStaffMember, type TeamStaffMember } from '../../hooks/useTeamStaff';
import { getTeamSeasonWritableState } from '../../lib/seasonTransition';
import type { PlayerPhotoLayout } from '../../lib/playerPhotoLayout';

const PhotoEditor = lazy(() => import('../../manager/ManagerPlayerPhotoEditor').then(module => ({ default: module.ManagerPlayerPhotoEditor })));

export function staffPortraitSubject(member: TeamStaffMember, seasonId: string): RosterPlayer {
  return { id: member.user_id, team_season_id: seasonId, first_name: member.first_name, last_name: member.last_name, display_name: [member.first_name, member.last_name].filter(Boolean).join(' ') || 'Trainer', avatar_url: member.avatar_url, cutout_url: member.cutout_url ?? null, photo_layout: member.photo_layout, jersey_number: null, position: null, birthdate: null, is_active: true, status: 'active', is_laz_player: false, is_injured: false, injured_since: null, injured_until: null };
}

/** Reuses the Manager's layout/RPCs; entering from a profile only edits that person. */
export function ProfilePhotoQuickAccess({ seasonId, player, staff, canEdit, onPlayerSaved, onStaffSaved, onReplacePhoto }: {
  seasonId: string;
  player?: RosterPlayer;
  staff?: TeamStaffMember;
  canEdit: boolean;
  onPlayerSaved?: (player: RosterPlayer) => void;
  onStaffSaved?: (layout: PlayerPhotoLayout | null) => void;
  onReplacePhoto: () => void;
}) {
  const id = player?.id ?? staff?.user_id;
  const [open, setOpen] = useState(false);
  const [subject, setSubject] = useState<RosterPlayer | null>(null);
  const [error, setError] = useState('');
  const [dirty, setDirty] = useState(false);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const trainer = Boolean(staff);
  useEffect(() => {
    if (!open || !canEdit || !id) return;
    let cancelled = false;
    setLoading(true); setError(''); setSubject(null); setDirty(false);
    void (async () => {
      try {
        const writable = await getTeamSeasonWritableState(seasonId);
        if ('error' in writable || !writable.writable) throw Error('error' in writable ? writable.error : writable.message);
        let found: RosterPlayer | null = null;
        if (trainer) {
          const result = await fetchTeamStaffMember(seasonId, id);
          if (result.error) throw Error(result.error);
          found = result.member ? staffPortraitSubject(result.member, seasonId) : null;
        } else {
          const result = await listRoster(seasonId, 'all');
          if (result.error) throw Error(result.error);
          found = result.data.find(item => item.id === id) ?? null;
        }
        if (!found) throw Error('Profil konnte nicht geladen werden. Bitte neu öffnen.');
        if (!cancelled) setSubject(found);
      } catch (failure) { if (!cancelled) setError(failure instanceof Error ? failure.message : 'Fotoeditor konnte nicht geladen werden.'); }
      finally { if (!cancelled) setLoading(false); }
    })();
    return () => { cancelled = true; };
  }, [open, canEdit, id, seasonId, trainer]);
  function canLeave() { return !busy && (!dirty || window.confirm('Ungespeicherte Fotoänderungen verwerfen?')); }
  if (!canEdit || !id) return null;
  return <>
    <button type="button" aria-label={trainer ? 'Trainerfoto bearbeiten' : 'Spielerfoto bearbeiten'} title="Foto bearbeiten" aria-haspopup="dialog" aria-expanded={open} onClick={() => setOpen(true)}
      className="absolute bottom-5 right-3 z-30 inline-flex h-11 w-11 items-center justify-center rounded-full border border-white/20 bg-black/65 text-[rgb(var(--club-accent-text-rgb))] shadow-lg backdrop-blur-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[rgb(var(--club-accent-rgb))]">
      <Camera className="h-5 w-5" aria-hidden />
    </button>
    {open ? <Modal isOpen title={trainer ? 'Trainerfoto anpassen' : 'Spielerfoto anpassen'} onClose={() => { if (canLeave()) setOpen(false); }}>
      <div onTouchStart={event => event.stopPropagation()} onTouchEnd={event => event.stopPropagation()}>
      {loading ? <p role="status" className="text-sm text-white/70">Fotoeditor wird geladen…</p> : null}
      {error ? <p role="alert" className="text-sm text-red-300">{error}</p> : null}
      {subject ? <Suspense fallback={<p role="status">Bildbearbeitung wird geladen…</p>}>
        <PhotoEditor key={`${seasonId}:${id}`} quick imageOnly player={subject} seasonId={seasonId} trainer={trainer} onDirtyChange={setDirty} onBusyChange={setBusy}
          onClose={() => { if (canLeave()) setOpen(false); }}
          onReplacePhoto={() => { if (canLeave()) { setOpen(false); onReplacePhoto(); } }}
          onSaved={layout => {
            if (trainer) onStaffSaved?.(layout ?? null);
            else onPlayerSaved?.({ ...subject, photo_layout: layout ?? null });
            setDirty(false); setOpen(false);
            window.dispatchEvent(new Event('manager-setup-changed'));
          }} />
      </Suspense> : null}
      </div>
    </Modal> : null}
  </>;
}
