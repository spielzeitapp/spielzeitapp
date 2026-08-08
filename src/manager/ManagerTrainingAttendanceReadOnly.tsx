/**
 * STEP 3C: Nur-Lese-Anzeige der bestehenden Event-Anwesenheit.
 * Keine Writes auf event_attendance.
 */

import React, { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { useEventsAttendance } from '../hooks/useEventsAttendance';
import { usePlayers } from '../hooks/usePlayers';
import {
  dbStatusToTrainingAttendance,
  trainingAttendanceLabel,
  type TrainingAttendanceStatus,
} from '../lib/trainingAttendance';

type Props = {
  eventId: string | null | undefined;
  teamSeasonId: string | null | undefined;
};

const ORDER: TrainingAttendanceStatus[] = [
  'present',
  'absent',
  'open',
  'sick',
  'injured',
  'external',
];

const DISPLAY_LABEL: Partial<Record<TrainingAttendanceStatus, string>> = {
  present: 'Zugesagt',
  absent: 'Abgesagt',
  open: 'Offen',
  sick: 'Krank',
  injured: 'Verletzt',
  external: 'LAZ',
};

export function ManagerTrainingAttendanceReadOnly({
  eventId,
  teamSeasonId,
}: Props): React.ReactElement | null {
  const ids = useMemo(() => (eventId ? [eventId] : []), [eventId]);
  const { byEventId, loading, error } = useEventsAttendance(ids);
  const { players } = usePlayers(teamSeasonId ?? null, { mode: 'active' });
  const [open, setOpen] = useState(false);

  if (!eventId) return null;

  const data = byEventId[eventId];
  const squad = players.length;
  const answered = data ? Object.keys(data.availabilityByPlayerId).length : 0;
  const openCount = Math.max(0, squad - answered);

  const counts: Partial<Record<TrainingAttendanceStatus, number>> = {
    present: data?.yes ?? 0,
    absent: data?.no ?? 0,
    open: openCount,
    sick: data?.sick ?? 0,
    injured: data?.injured ?? 0,
    external: data?.external ?? 0,
  };

  const summary = ORDER.filter((k) => (counts[k] ?? 0) > 0)
    .map((k) => `${counts[k]} ${(DISPLAY_LABEL[k] ?? trainingAttendanceLabel(k)).toLowerCase()}`)
    .join(' · ');

  const roster = players.map((p) => {
    const raw = data?.availabilityByPlayerId[p.id];
    const status = raw ? dbStatusToTrainingAttendance(raw) ?? 'open' : 'open';
    return {
      id: p.id,
      name: p.display_name || [p.first_name, p.last_name].filter(Boolean).join(' ') || 'Spieler',
      status,
    };
  });

  return (
    <section className="rounded-2xl border border-slate-200/90 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)]">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-[15px] font-semibold text-slate-900">Anwesenheit</h2>
          <p className="mt-1 text-[12px] text-slate-500">
            Nur Anzeige – Änderungen über die bestehende Beteiligungsfunktion.
          </p>
        </div>
        <Link
          to={`/app/events/${encodeURIComponent(eventId)}`}
          className="text-[12px] font-semibold text-red-700"
        >
          Beteiligung öffnen
        </Link>
      </div>

      {loading ? (
        <p className="mt-3 text-[13px] text-slate-400">Anwesenheit wird geladen…</p>
      ) : error ? (
        <p className="mt-3 text-[13px] text-amber-700">{error}</p>
      ) : !data && squad === 0 ? (
        <p className="mt-3 text-[13px] text-slate-500">Keine Anwesenheitsdaten vorhanden.</p>
      ) : (
        <>
          <p className="mt-3 text-[14px] text-slate-800">
            {summary || 'Noch keine Rückmeldungen'}
          </p>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="mt-2 min-h-[40px] text-[13px] font-semibold text-red-700"
          >
            {open ? 'Liste einklappen' : 'Teilnehmerliste'}
          </button>
          {open ? (
            <ul className="mt-2 max-h-56 space-y-1 overflow-y-auto rounded-xl border border-slate-100 bg-slate-50 p-2">
              {roster.length === 0 ? (
                <li className="px-2 py-1 text-[13px] text-slate-500">Kein Kader geladen.</li>
              ) : (
                roster.map((r) => (
                  <li
                    key={r.id}
                    className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-[13px]"
                  >
                    <span className="text-slate-800">{r.name}</span>
                    <span className="text-slate-500">
                      {DISPLAY_LABEL[r.status] ?? trainingAttendanceLabel(r.status)}
                    </span>
                  </li>
                ))
              )}
            </ul>
          ) : null}
        </>
      )}
    </section>
  );
}
