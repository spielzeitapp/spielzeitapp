import React, {useEffect, useRef, useState} from 'react';
import {Maximize2, Minimize2, RefreshCw} from 'lucide-react';

/** One iframe in both sizes: expanding keeps its current page and scroll position. */
export function ManagerPhonePreview({clubId, seasonId}: {clubId: string; seasonId: string}) {
  const [expanded, setExpanded] = useState(false);
  const [revision, setRevision] = useState(0);
  const dialog = useRef<HTMLDialogElement>(null);
  const expandButton = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (expanded && !element.matches(':modal')) {
      element.close();
      element.showModal();
    } else if (!expanded && element.matches(':modal')) {
      element.close();
      // Return to the inline preview without replacing the iframe.
      element.show();
      expandButton.current?.focus();
    }
  }, [expanded]);
  return <div className="szc-phone-preview" data-central-preserve>
    <div className="szc-preview-actions">
      <button ref={expandButton} type="button" className="szc-outline" onClick={() => setExpanded(true)}><Maximize2 size={16}/>Vergrößern</button>
      <button type="button" className="szc-outline" onClick={() => setRevision(value => value + 1)} aria-label="App-Vorschau aktualisieren"><RefreshCw size={16}/></button>
    </div>
    <dialog ref={dialog} open className="szc-preview-dialog" role={expanded ? 'dialog' : 'region'} aria-modal={expanded || undefined} aria-label="Bedienbare TEST-App" onCancel={event => {event.preventDefault(); setExpanded(false);}}>
      {expanded && <div className="szc-preview-dialog-header"><div><strong>Deine TEST-App</strong><p>Originalansicht · Änderungen gesperrt</p></div><button type="button" className="szc-outline" onClick={() => setExpanded(false)}><Minimize2 size={16}/>Verkleinern</button></div>}
      <div className="szc-real-phone"><iframe key={`${clubId}:${seasonId}:${revision}`} loading="lazy" title="Aktuelle TEST-App in der Handyvorschau" sandbox="allow-scripts allow-same-origin" src={`/app-preview?clubId=${encodeURIComponent(clubId)}&teamSeasonId=${encodeURIComponent(seasonId)}&start=team`}/></div>
    </dialog>
  </div>;
}
