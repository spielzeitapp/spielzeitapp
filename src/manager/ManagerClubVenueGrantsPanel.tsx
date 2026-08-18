/**
 * Vereinsdetail: Grants je Team-Saison inkl. Plätze. Keine Eigentumsübertragung.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  adminSetTeamSeasonVenueGrant,
  type GrantableVenue,
} from '../lib/platformClubAdmin';
import { listFieldZones, listVenueFields, type VenueFieldRow } from '../lib/venueFields';
import {
  countFutureAssignmentsForVenueGrant,
  groupVenueGrantsByVenue,
  listTrainingVenuesForTeamSeason,
  venuesAvailableForPurposeGrant,
  type GroupedVenueGrant,
  type VenuePurpose,
} from '../lib/teamSeasonTrainingVenues';

type FieldPreview = {
  id: string;
  name: string;
  zones: string[];
};

type Props = {
  teamSeasons: Array<{ id: string; label: string }>;
  selectedTeamSeasonId: string;
  onSelectTeamSeason: (id: string) => void;
  grantableVenues: GrantableVenue[];
  busy: boolean;
  onBusyError: (error: string | null, success?: string | null) => void;
};

export function ManagerClubVenueGrantsPanel(props: Props): React.ReactElement {
  const [grouped, setGrouped] = useState<GroupedVenueGrant[]>([]);
  const [fieldsByVenue, setFieldsByVenue] = useState<Record<string, FieldPreview[]>>({});
  const [expandedZones, setExpandedZones] = useState<Record<string, boolean>>({});
  const [loading, setLoading] = useState(false);
  const [addVenueId, setAddVenueId] = useState('');
  const [addPurpose, setAddPurpose] = useState<VenuePurpose>('training');
  const [localBusy, setLocalBusy] = useState(false);

  const reload = useCallback(async () => {
    if (!props.selectedTeamSeasonId) {
      setGrouped([]);
      setFieldsByVenue({});
      return;
    }
    setLoading(true);
    const linked = await listTrainingVenuesForTeamSeason(props.selectedTeamSeasonId, {
      purpose: 'all',
    });
    const next = groupVenueGrantsByVenue(linked.data);
    setGrouped(next);
    const fields: Record<string, FieldPreview[]> = {};
    for (const g of next) {
      const fRes = await listVenueFields(g.venueId);
      const previews: FieldPreview[] = [];
      for (const field of fRes.data.filter((f: VenueFieldRow) => f.is_active !== false)) {
        const zRes = await listFieldZones(field.id);
        previews.push({
          id: field.id,
          name: field.name,
          zones: zRes.data.filter((z) => z.is_active !== false).map((z) => z.name),
        });
      }
      fields[g.venueId] = previews;
    }
    setFieldsByVenue(fields);
    setLoading(false);
  }, [props.selectedTeamSeasonId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const addable = useMemo(
    () => venuesAvailableForPurposeGrant(props.grantableVenues, grouped, addPurpose),
    [props.grantableVenues, grouped, addPurpose],
  );

  async function setGrant(venueId: string, purpose: VenuePurpose, isActive: boolean) {
    if (!props.selectedTeamSeasonId) return;
    setLocalBusy(true);
    props.onBusyError(null, null);
    if (!isActive) {
      const usage = await countFutureAssignmentsForVenueGrant({
        teamSeasonId: props.selectedTeamSeasonId,
        venueId,
        purpose,
      });
      if (usage.error) {
        setLocalBusy(false);
        props.onBusyError(usage.error);
        return;
      }
      if (usage.count > 0) {
        setLocalBusy(false);
        props.onBusyError(
          `Diese Freigabe kann nicht entzogen werden: ${usage.count} zukünftige Belegung(en) nutzen diese Anlage.`,
        );
        return;
      }
    }
    const res = await adminSetTeamSeasonVenueGrant({
      teamSeasonId: props.selectedTeamSeasonId,
      venueId,
      purpose,
      isActive,
    });
    setLocalBusy(false);
    if (res.error) {
      props.onBusyError(res.error);
      return;
    }
    props.onBusyError(
      null,
      isActive
        ? purpose === 'home_match'
          ? 'Heimspiel-Freigabe gespeichert.'
          : 'Training-Freigabe gespeichert.'
        : purpose === 'home_match'
          ? 'Heimspiel-Freigabe entzogen.'
          : 'Training-Freigabe entzogen.',
    );
    setAddVenueId('');
    await reload();
  }

  const disabled = props.busy || localBusy || !props.selectedTeamSeasonId;

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <h2 className="text-[16px] font-semibold text-slate-900">Freigegebene Anlagen und Plätze</h2>
      <p className="mt-1 text-[12px] text-slate-500">
        Nur diese Freigaben sind für Trainer bei Training und Heimspiel auswählbar. Eigentum der
        Anlage bleibt unverändert.
      </p>
      <label className="mt-3 block text-[13px] font-medium text-slate-700">
        Team-Saison
        <select
          className="mt-1 h-10 w-full max-w-xl rounded-lg border border-slate-200 px-3 text-[13px]"
          value={props.selectedTeamSeasonId}
          onChange={(e) => props.onSelectTeamSeason(e.target.value)}
        >
          <option value="">Saison wählen…</option>
          {props.teamSeasons.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
      </label>

      {loading ? <p className="mt-3 text-[13px] text-slate-600">Freigaben werden geladen…</p> : null}
      {!loading && props.selectedTeamSeasonId && grouped.length === 0 ? (
        <p className="mt-3 text-[13px] text-slate-600">
          Für diese Saison ist noch keine Anlage freigegeben.
        </p>
      ) : null}

      <ul className="mt-3 space-y-3">
        {grouped.map((g) => {
          const fields = fieldsByVenue[g.venueId] ?? [];
          const showZones = Boolean(expandedZones[g.venueId]);
          return (
            <li key={g.venueId} className="rounded-xl border border-slate-100 bg-slate-50 p-3">
              <p className="text-[14px] font-semibold text-slate-900">{g.venueName}</p>
              <p className="mt-1 text-[13px] text-slate-700">
                Training: {g.training ? 'freigegeben' : 'nein'}
                {' · '}
                Heimspiel: {g.homeMatch ? 'freigegeben' : 'nein'}
              </p>
              <p className="mt-2 text-[12px] font-medium text-slate-600">Plätze</p>
              {fields.length === 0 ? (
                <p className="text-[13px] text-slate-500">Keine Plätze erfasst.</p>
              ) : (
                <ul className="mt-1 space-y-1 text-[13px] text-slate-800">
                  {fields.map((f) => (
                    <li key={f.id}>
                      {f.name}
                      {showZones && f.zones.length > 0 ? (
                        <span className="text-slate-500"> · {f.zones.join(', ')}</span>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
              {fields.some((f) => f.zones.length > 0) ? (
                <button
                  type="button"
                  className="mt-1 text-[12px] font-semibold text-slate-600 underline-offset-2 hover:underline"
                  onClick={() =>
                    setExpandedZones((prev) => ({ ...prev, [g.venueId]: !prev[g.venueId] }))
                  }
                >
                  {showZones ? 'Teilflächen ausblenden' : 'Teilflächen anzeigen'}
                </button>
              ) : null}
              <div className="mt-3 flex flex-wrap gap-2">
                {g.training ? (
                  <button
                    type="button"
                    disabled={disabled}
                    className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-[12px] font-semibold text-slate-800 disabled:opacity-50"
                    onClick={() => void setGrant(g.venueId, 'training', false)}
                  >
                    Training entziehen
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={disabled}
                    className="rounded-lg bg-red-700 px-3 py-1.5 text-[12px] font-semibold text-white disabled:opacity-50"
                    onClick={() => void setGrant(g.venueId, 'training', true)}
                  >
                    Training freigeben
                  </button>
                )}
                {g.homeMatch ? (
                  <button
                    type="button"
                    disabled={disabled}
                    className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-[12px] font-semibold text-slate-800 disabled:opacity-50"
                    onClick={() => void setGrant(g.venueId, 'home_match', false)}
                  >
                    Heimspiel entziehen
                  </button>
                ) : (
                  <button
                    type="button"
                    disabled={disabled}
                    className="rounded-lg bg-red-700 px-3 py-1.5 text-[12px] font-semibold text-white disabled:opacity-50"
                    onClick={() => void setGrant(g.venueId, 'home_match', true)}
                  >
                    Heimspiel freigeben
                  </button>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      <form
        className="mt-4 space-y-2 rounded-xl border border-slate-100 bg-slate-50 p-3"
        onSubmit={(e) => {
          e.preventDefault();
          if (!addVenueId) return;
          void setGrant(addVenueId, addPurpose, true);
        }}
      >
        <p className="text-[13px] font-semibold text-slate-800">Weitere Anlage freigeben</p>
        <p className="text-[12px] text-slate-500">
          Nur Anlagen, für die dieser Zweck bei der gewählten Saison noch nicht freigegeben ist.
          Keine Dublette, kein Eigentumswechsel.
        </p>
        <select
          className="h-10 w-full rounded-lg border border-slate-200 px-3 text-[13px]"
          value={addPurpose}
          onChange={(e) => {
            setAddPurpose(e.target.value === 'home_match' ? 'home_match' : 'training');
            setAddVenueId('');
          }}
        >
          <option value="training">Training</option>
          <option value="home_match">Heimspiel</option>
        </select>
        <select
          className="h-10 w-full rounded-lg border border-slate-200 px-3 text-[13px]"
          value={addVenueId}
          onChange={(e) => setAddVenueId(e.target.value)}
        >
          <option value="">Anlage wählen…</option>
          {addable.map((v) => (
            <option key={v.id} value={v.id}>
              {v.name} ({v.club_name})
            </option>
          ))}
        </select>
        <button
          type="submit"
          disabled={disabled || !addVenueId}
          className="rounded-lg bg-red-700 px-3 py-2 text-[13px] font-semibold text-white disabled:opacity-50"
        >
          Freigabe speichern
        </button>
      </form>
    </section>
  );
}
