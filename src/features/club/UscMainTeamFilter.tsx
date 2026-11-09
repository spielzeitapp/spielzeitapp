import React, { useEffect, useMemo, useRef, useState } from "react";
import { X } from "lucide-react";
import { clubSeasonTeamName, sortClubSeasons, type ClubSeason } from "./uscClub";

function readSelection(userId: string | null): string[] | null {
  if (!userId || typeof window === "undefined") return null;
  try {
    // Keep the existing Home preference when moving to the shared filter.
    const raw = window.localStorage.getItem(`spz_usc_my_teams_${userId}`)
      ?? window.localStorage.getItem(`spz_usc_news_teams_${userId}`);
    const value: unknown = JSON.parse(raw ?? "null");
    return Array.isArray(value) && value.every((id) => typeof id === "string") ? [...new Set(value)] : null;
  } catch { return null; }
}

export function useUscTeamSelection(userId: string | null, available: ClubSeason[]) {
  const scopes = useMemo(() => sortClubSeasons(available), [available]);
  const ids = useMemo(() => scopes.map((season) => season.id), [scopes]);
  const saved = useMemo(() => readSelection(userId), [userId]);
  const [state, setState] = useState<{ userId: string | null; selected: string[] | null } | null>(null);
  const selected = state?.userId === userId ? state.selected : saved;
  const visibleIds = useMemo(() => {
    if (selected == null) return ids;
    const current = ids.filter((id) => selected.includes(id));
    return selected.length && !current.length ? ids : current;
  }, [selected, ids]);
  const seasons = useMemo(() => scopes.filter((season) => visibleIds.includes(season.id)), [scopes, visibleIds]);
  const save = (values: string[]) => {
    const valid = ids.filter((id) => values.includes(id));
    const next = valid.length === ids.length ? null : valid;
    setState({ userId, selected: next });
    try { if (userId && typeof window !== "undefined") window.localStorage.setItem(`spz_usc_my_teams_${userId}`, JSON.stringify(next)); } catch { /* Session selection still works without local storage. */ }
  };
  return { scopes, seasons, visibleIds, allSelected: visibleIds.length === ids.length, save };
}

export function UscMainTeamFilter({ open, scopes, visibleIds, onApply, onClose }: {
  open: boolean;
  scopes: ClubSeason[];
  visibleIds: string[];
  onApply: (ids: string[]) => void;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [draft, setDraft] = useState<string[]>([]);
  const visibleKey = visibleIds.join(",");
  useEffect(() => {
    if (open) { setDraft(visibleKey ? visibleKey.split(",") : []); dialog.current?.showModal(); }
    else dialog.current?.close();
  }, [open, visibleKey]);
  return <dialog className="usc-dialog usc-news-filter" ref={dialog} aria-label="Meine Mannschaften auswählen" onCancel={onClose} onClose={onClose}>
    <button type="button" className="usc-dialog-close" aria-label="Mannschaftsfilter schließen" onClick={onClose}><X /></button>
    <h2>Meine Mannschaften</h2><p>Diese Auswahl gilt für Home, Teams, Spiele und Tabelle.</p>
    <div className="usc-filter-shortcuts"><button type="button" onClick={() => setDraft(scopes.map((season) => season.id))}>Alle Mannschaften anzeigen</button><button type="button" onClick={() => setDraft([])}>Alle abwählen</button></div>
    <fieldset><legend className="sr-only">Mannschaften auswählen</legend>{scopes.map((season) => <label key={season.id} className="usc-filter-team"><input type="checkbox" checked={draft.includes(season.id)} onChange={(event) => setDraft((previous) => event.target.checked ? [...new Set([...previous, season.id])] : previous.filter((id) => id !== season.id))} /><span><strong>{season.age_group === "RES" ? "Reserve" : season.age_group}</strong><small>{clubSeasonTeamName(season)} · {season.season?.name}</small></span></label>)}</fieldset>
    <button type="button" className="usc-action" onClick={() => { onApply(draft); onClose(); }}>Auswahl übernehmen</button>
    <p className="usc-filter-hint">Die Auswahl wird für dein Konto auf diesem Gerät gespeichert.</p>
  </dialog>;
}
