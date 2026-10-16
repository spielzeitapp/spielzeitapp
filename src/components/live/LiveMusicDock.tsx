import React, { useEffect, useRef, useState } from 'react';
import { Music2, X } from 'lucide-react';
import { useSession } from '../../auth/useSession';
import { canAccessManager } from '../../manager/canAccessManager';
import { DjAudioPanel } from '../../manager/components/DjAudioPanel';
import '../../manager/managerSpeakerStudio.css';
import './liveMusicDock.css';

/** Keep the SAME audio panel mounted when closing or expanding the dialog. */
export function LiveMusicWindow({ scope, showButton }: { scope: string; showButton: boolean }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [activated, setActivated] = useState(false);
  const [fullPlayer, setFullPlayer] = useState(false);
  useEffect(() => {
    const element = dialog.current;
    if (open && element && !element.open) element.showModal();
    if (!open && element?.open) element.close();
  }, [open]);
  useEffect(() => { if (dialog.current) dialog.current.scrollTop = 0; }, [open, fullPlayer]);
  function close() { setOpen(false); trigger.current?.focus(); }
  return <>
    {showButton ? <div className="live-music-toolbar"><button ref={trigger} type="button" className="live-music-trigger" aria-haspopup="dialog" aria-expanded={open}
      onClick={() => { setActivated(true); setFullPlayer(false); setOpen(true); }}><span className="live-music-trigger-icon"><Music2 aria-hidden /></span><span>Musikplayer</span><span className="live-music-trigger-arrow" aria-hidden>›</span></button></div> : null}
    <dialog ref={dialog} className="live-music-dialog" aria-labelledby="live-music-title"
      onCancel={event => { event.preventDefault(); close(); }} onClose={() => setOpen(false)}>
      <header className="live-music-heading">
        <h2 id="live-music-title"><Music2 aria-hidden />Musikplayer</h2>
        <button type="button" aria-label="Musikfenster schließen und zum Liveticker zurück" onClick={close}><X aria-hidden /></button>
      </header>
      <p className="live-music-note">Beim Schließen läuft die Musik weiter. Beenden mit „Alles stoppen“.</p>
      <div className="speaker-studio speaker-studio--dark">
        {activated ? <DjAudioPanel scope={scope} offlineMusicOnly quickMode={!fullPlayer} /> : null}
      </div>
      <footer className="live-music-footer">
        <button type="button" onClick={() => setFullPlayer(value => !value)}>{fullPlayer ? 'Schnelltasten' : 'Player öffnen'}</button>
        <button type="button" onClick={close}>Zurück zum Liveticker</button>
      </footer>
    </dialog>
  </>;
}
function AuthorizedLiveMusicDock({ showButton }: { showButton: boolean }) {
  const { user, backendRole, memberships, viewTeamSeasonId, selectedTeamSeasonId } = useSession();
  const seasonId = viewTeamSeasonId ?? selectedTeamSeasonId;
  // Match Live's existing music-module staff access; never grant parent/fan access.
  if (!user || !seasonId || !canAccessManager(backendRole, (memberships ?? []).filter(m => m.team_season_id === seasonId))) return null;
  const scope = user.id + ':' + seasonId;
  return <LiveMusicWindow key={scope} scope={scope} showButton={showButton} />;
}
export function LiveMusicDock({ showButton }: { showButton: boolean }) {
  const visitedLive = useRef(false);
  if (showButton) visitedLive.current = true;
  if (!visitedLive.current) return null;
  return <AuthorizedLiveMusicDock showButton={showButton} />;
}
