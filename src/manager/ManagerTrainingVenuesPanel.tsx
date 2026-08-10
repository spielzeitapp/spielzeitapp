/**
 * PLATZ.5: Erlaubte Trainingsanlagen einer Mannschaftssaison verwalten.
 */
import React, { useCallback, useEffect, useState } from 'react';
import { listVenuesForClub, resolveClubIdForTeamSeason, type VenueRow } from '../lib/venues';
import { listVenueFields } from '../lib/venueFields';
import {
  assignTrainingVenue,
  listTrainingVenuesForTeamSeason,
  setTrainingVenueActive,
  type TeamSeasonTrainingVenueRow,
} from '../lib/teamSeasonTrainingVenues';
import { canPrepareNextSeason } from '../lib/seasonLifecycle';

type LinkRow = TeamSeasonTrainingVenueRow & { venue: VenueRow | null };

export function ManagerTrainingVenuesPanel(props: {
  teamSeasonId: string;
  effectiveRole: string;
  backendRole: string;
}): React.ReactElement {
  const canManage =
    (props.backendRole ?? '').trim().toLowerCase() === 'admin' ||
    canPrepareNextSeason(props.effectiveRole) ||
    canPrepareNextSeason(props.backendRole) ||
    (props.effectiveRole ?? '').trim().toLowerCase() === 'admin';

  const [links, setLinks] = useState<LinkRow[]>([]);
  const [catalog, setCatalog] = useState<VenueRow[]>([]);
  const [pickId, setPickId] = useState('');
  const [fieldsPreview, setFieldsPreview] = useState<Record<string, string[]>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    const linked = await listTrainingVenuesForTeamSeason(props.teamSeasonId, { includeInactive: true });
    if (linked.error) setError(linked.error);
    setLinks(linked.data);
    const club = await resolveClubIdForTeamSeason(props.teamSeasonId);
    if (club.clubId) {
      const venues = await listVenuesForClub(club.clubId);
      setCatalog(venues.data.filter((v) => v.is_active));
    }
    const preview: Record<string, string[]> = {};
    for (const l of linked.data) {
      if (!l.venue_id) continue;
      const f = await listVenueFields(l.venue_id);
      preview[l.venue_id] = f.data.filter((x) => x.is_active).map((x) => x.name);
    }
    setFieldsPreview(preview);
    setLoading(false);
  }, [props.teamSeasonId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const assignedIds = new Set(links.filter((l) => l.is_active).map((l) => l.venue_id));
  const addable = catalog.filter((v) => !assignedIds.has(v.id));

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="text-[14px] font-semibold text-slate-900">Erlaubte Trainingsanlagen</h3>
      <p className="mt-1 text-[12px] text-slate-500">
        Nur diese Anlagen erscheinen beim Anlegen eines Trainings. Spiele und Turniere bleiben
        uneingeschränkt.
      </p>
      {loading ? <p className="mt-3 text-[12px] text-slate-400">Laden…</p> : null}
      {error ? (
        <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[12px] text-red-800">
          {error}
        </p>
      ) : null}
      <ul className="mt-3 space-y-2">
        {links.length === 0 && !loading ? (
          <li className="rounded-lg border border-dashed border-slate-200 px-3 py-3 text-[12px] text-slate-500">
            Noch keine Trainingsanlage freigegeben.
          </li>
        ) : null}
        {links.map((l) => (
          <li
            key={l.id}
            className="flex flex-wrap items-start justify-between gap-2 rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-2"
          >
            <div>
              <p className="text-[13px] font-semibold text-slate-800">
                {l.venue?.name ?? 'Anlage'}
                {!l.is_active ? (
                  <span className="ml-2 text-[11px] font-medium text-slate-400">(deaktiviert)</span>
                ) : null}
              </p>
              <p className="text-[11px] text-slate-500">
                Plätze:{' '}
                {(fieldsPreview[l.venue_id] ?? []).length
                  ? (fieldsPreview[l.venue_id] ?? []).join(' · ')
                  : 'noch keine'}
              </p>
            </div>
            {canManage ? (
              <button
                type="button"
                disabled={busy}
                className="text-[11px] font-semibold text-slate-500 hover:text-slate-800"
                onClick={async () => {
                  setBusy(true);
                  await setTrainingVenueActive({ linkId: l.id, isActive: !l.is_active });
                  setBusy(false);
                  await reload();
                }}
              >
                {l.is_active ? 'Deaktivieren' : 'Reaktivieren'}
              </button>
            ) : (
              <span className="text-[11px] text-slate-400">Nur ansehen</span>
            )}
          </li>
        ))}
      </ul>
      {canManage ? (
        <div className="mt-3 flex flex-wrap gap-2">
          <select
            value={pickId}
            onChange={(e) => setPickId(e.target.value)}
            className="min-w-[12rem] flex-1 rounded-lg border border-slate-200 px-2.5 py-2 text-[12px]"
          >
            <option value="">Anlage zuweisen…</option>
            {addable.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={busy || !pickId}
            className="rounded-full bg-red-700 px-4 py-2 text-[12px] font-semibold text-white disabled:opacity-40"
            onClick={async () => {
              setBusy(true);
              const res = await assignTrainingVenue({
                teamSeasonId: props.teamSeasonId,
                venueId: pickId,
                sortOrder: links.length * 10,
              });
              setBusy(false);
              if (res.error) setError(res.error);
              else {
                setPickId('');
                await reload();
              }
            }}
          >
            Zuweisen
          </button>
        </div>
      ) : (
        <p className="mt-3 text-[11px] text-slate-400">
          Trainer sehen die Freigaben, Änderungen nur durch Jugendleiter/Vereinsadmin.
        </p>
      )}
    </section>
  );
}
