/**
 * PLATZ.5/6: Erlaubte Anlagen einer Mannschaftssaison (Training + Heimspiel).
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { listVenuesForClub, resolveClubIdForTeamSeason, type VenueRow } from '../lib/venues';
import { listVenueFields } from '../lib/venueFields';
import {
  assignTrainingVenue,
  listTrainingVenuesForTeamSeason,
  setTrainingVenueActive,
  type TeamSeasonTrainingVenueRow,
  type VenuePurpose,
} from '../lib/teamSeasonTrainingVenues';

type LinkRow = TeamSeasonTrainingVenueRow & { venue: VenueRow | null };

const PURPOSE_LABEL: Record<VenuePurpose, string> = {
  training: 'Training',
  home_match: 'Heimspiel',
};

export function ManagerTrainingVenuesPanel(props: {
  teamSeasonId: string;
  effectiveRole: string;
  backendRole: string;
}): React.ReactElement {
  const canManage =
    (props.backendRole ?? '').trim().toLowerCase() === 'admin' ||
    (props.effectiveRole ?? '').trim().toLowerCase() === 'admin';

  const [links, setLinks] = useState<LinkRow[]>([]);
  const [catalog, setCatalog] = useState<VenueRow[]>([]);
  const [pickId, setPickId] = useState('');
  const [pickPurpose, setPickPurpose] = useState<VenuePurpose>('training');
  const [fieldsPreview, setFieldsPreview] = useState<Record<string, string[]>>({});
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    const linked = await listTrainingVenuesForTeamSeason(props.teamSeasonId, {
      includeInactive: true,
      purpose: 'all',
    });
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
      if (preview[l.venue_id]) continue;
      const f = await listVenueFields(l.venue_id);
      preview[l.venue_id] = f.data.filter((x) => x.is_active).map((x) => x.name);
    }
    setFieldsPreview(preview);
    setLoading(false);
  }, [props.teamSeasonId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const trainingLinks = useMemo(
    () => links.filter((l) => (l.purpose ?? 'training') === 'training'),
    [links],
  );
  const homeMatchLinks = useMemo(
    () => links.filter((l) => l.purpose === 'home_match'),
    [links],
  );

  const assignedForPick = new Set(
    links
      .filter((l) => l.is_active && (l.purpose ?? 'training') === pickPurpose)
      .map((l) => l.venue_id),
  );
  const addable = catalog.filter((v) => !assignedForPick.has(v.id));

  const renderLinkList = (sectionLinks: LinkRow[], emptyText: string) => (
    <ul className="mt-3 space-y-2">
      {sectionLinks.length === 0 && !loading ? (
        <li className="rounded-lg border border-dashed border-slate-200 px-3 py-3 text-[12px] text-slate-500">
          {emptyText}
        </li>
      ) : null}
      {sectionLinks.map((l) => (
        <li
          key={l.id}
          className="flex flex-wrap items-start justify-between gap-2 rounded-xl border border-slate-100 bg-slate-50/80 px-3 py-2"
        >
          <div>
            <p className="text-[13px] font-semibold text-slate-800">
              {l.venue?.name ?? 'Anlage'}
              <span className="ml-2 rounded-full bg-slate-200/80 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                {PURPOSE_LABEL[l.purpose ?? 'training']}
              </span>
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
  );

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <h3 className="text-[14px] font-semibold text-slate-900">Erlaubte Anlagen</h3>
      <p className="mt-1 text-[12px] text-slate-500">
        Freigaben getrennt nach Zweck: Training (z.&nbsp;B. St.&nbsp;Veit + Rohrbach) und Heimspiel
        (z.&nbsp;B. nur Rohrbach). Auswärtsspiele nutzen keine lokale Platzzuordnung.
      </p>
      {loading ? <p className="mt-3 text-[12px] text-slate-400">Laden…</p> : null}
      {error ? (
        <p className="mt-3 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-[12px] text-red-800">
          {error}
        </p>
      ) : null}

      <div className="mt-4">
        <h4 className="text-[12px] font-semibold uppercase tracking-wide text-slate-600">
          Training
        </h4>
        {renderLinkList(trainingLinks, 'Noch keine Trainingsanlage freigegeben.')}
      </div>

      <div className="mt-5">
        <h4 className="text-[12px] font-semibold uppercase tracking-wide text-slate-600">
          Heimspiel
        </h4>
        {renderLinkList(homeMatchLinks, 'Noch keine Heimspiel-Anlage freigegeben.')}
      </div>

      {canManage ? (
        <div className="mt-4 flex flex-wrap gap-2">
          <select
            value={pickPurpose}
            onChange={(e) => {
              setPickPurpose(e.target.value as VenuePurpose);
              setPickId('');
            }}
            className="rounded-lg border border-slate-200 px-2.5 py-2 text-[12px]"
            aria-label="Zweck"
          >
            <option value="training">Zweck: Training</option>
            <option value="home_match">Zweck: Heimspiel</option>
          </select>
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
                purpose: pickPurpose,
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
          Trainer sehen die Freigaben. Änderungen nur durch Vereinsadmin oder Plattformadmin.
        </p>
      )}
    </section>
  );
}
