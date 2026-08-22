/**
 * APP-PLATZ.1 – Mobile Tagesansicht Platzbelegung (dunkles App-UI).
 * Daten: Grants + Shared Occupancy + availabilityHelpers / MiniMap.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import {
  ChevronDown,
  ArrowLeft,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Eye,
  MapPin,
  RefreshCw,
} from 'lucide-react';
import { useSession } from '../auth/useSession';
import { useActiveTeamSeason } from '../hooks/useActiveTeamSeason';
import { canSeeAppPlatzbelegung } from '../lib/appPlatzAccess';
import {
  loadAppPlatzDay,
  type AppPlatzDayBlock,
  type AppPlatzDayPayload,
} from '../lib/appPlatzDayData';
import { zoneRowToGeometry } from '../lib/venueFields';
import {
  canManageFacilityAssignmentForEvent,
  type ZoneMeta,
} from '../lib/fieldScheduleConflicts';
import { canManageMatches, normalizeRole } from '../lib/roles';
import {
  computeFieldDaySlots,
  computeVenueDaySummary,
  STATUS_LABELS,
  dayKeyToViennaMs,
  type SlotStatus,
} from '../manager/platz/availabilityHelpers';
import { FieldOccupancyMiniMap } from '../manager/platz/FieldOccupancyMiniMap';
import { addDays, toViennaDayKey } from '../pages/calendar/calendarUtils';
import { Modal } from '../app/ui/Modal';
import { formatTeamSeasonContextLabel } from '../lib/seasonLifecycle';
import {
  AppCreateOccupancyModal,
  type AppCreateOccupancyPrefill,
} from '../components/platz/AppCreateOccupancyModal';

const RANGE_START = 8;
const RANGE_END = 22;
const PX_PER_HOUR = 56;

function shiftDayKey(dayKey: string, deltaDays: number): string {
  const [y, m, d] = dayKey.split('-').map(Number);
  if (!y || !m || !d) return dayKey;
  const dt = new Date(y, m - 1, d, 12, 0, 0);
  return toViennaDayKey(addDays(dt, deltaDays));
}

function formatDayHeader(dayKey: string): string {
  const [y, m, d] = dayKey.split('-').map(Number);
  if (!y || !m || !d) return dayKey;
  return new Intl.DateTimeFormat('de-AT', {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
  }).format(new Date(y, m - 1, d, 12, 0, 0));
}

function statusChipClass(status: SlotStatus): string {
  if (status === 'free') return 'bg-emerald-500/20 text-emerald-200 border-emerald-400/40';
  if (status === 'partial') return 'bg-amber-500/20 text-amber-100 border-amber-400/40';
  return 'bg-red-500/25 text-red-100 border-red-400/40';
}

function buildZoneMetas(zones: AppPlatzDayPayload['zonesByField'][string]): ZoneMeta[] {
  return (zones ?? []).map((z) => {
    const geom = zoneRowToGeometry(z);
    return {
      id: z.id,
      name: z.name,
      blocksEntireField: z.blocks_entire_field || geom.layoutKind === 'entire',
      isActive: z.is_active,
      zone: geom,
      layoutKind: geom.layoutKind,
      rect: geom.rect,
    };
  });
}

function blockLeftPct(startsAtMs: number, dayKey: string): number {
  const start = dayKeyToViennaMs(dayKey, RANGE_START, 0);
  const end = dayKeyToViennaMs(dayKey, RANGE_END, 0);
  const span = Math.max(1, end - start);
  return Math.max(0, Math.min(100, ((startsAtMs - start) / span) * 100));
}

function blockWidthPct(startsAtMs: number, endsAtMs: number, dayKey: string): number {
  const start = dayKeyToViennaMs(dayKey, RANGE_START, 0);
  const end = dayKeyToViennaMs(dayKey, RANGE_END, 0);
  const span = Math.max(1, end - start);
  const left = Math.max(startsAtMs, start);
  const right = Math.min(endsAtMs, end);
  return Math.max(2, ((right - left) / span) * 100);
}

export const AppPlatzbelegungPage: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const sourceEventId = searchParams.get('event');
  const { effectiveRole, backendRole, memberships } = useSession();
  const { activeTeamSeasonId, activeTeamSeason, readTeamSeason } = useActiveTeamSeason();
  const contextSeason = readTeamSeason ?? activeTeamSeason;

  const allowed = canSeeAppPlatzbelegung({
    effectiveRole,
    backendRole,
    memberships: memberships ?? [],
  });

  const requestedDayKey = searchParams.get('date');
  const [dayKey, setDayKey] = useState(() =>
    /^\d{4}-\d{2}-\d{2}$/.test(requestedDayKey ?? '') ? requestedDayKey! : toViennaDayKey(new Date()),
  );
  const [payload, setPayload] = useState<AppPlatzDayPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedVenueIds, setExpandedVenueIds] = useState<Set<string>>(() => new Set());
  const [detail, setDetail] = useState<AppPlatzDayBlock | null>(null);
  const [createPrefill, setCreatePrefill] = useState<AppCreateOccupancyPrefill | null>(null);
  const [freeHint, setFreeHint] = useState<string | null>(null);

  const todayKey = toViennaDayKey(new Date());
  const teamLabel = useMemo(() => {
    if (!contextSeason) return 'Keine Mannschaft';
    return (
      formatTeamSeasonContextLabel({
        displayName: contextSeason.display_name,
        ageGroup: contextSeason.age_group,
        teamName: contextSeason.team?.name,
        seasonName: contextSeason.season?.name,
        status: contextSeason.status,
      }) || 'Mannschaft'
    );
  }, [contextSeason]);

  const canCreateOccupancy = useMemo(() => {
    if (!activeTeamSeasonId) return false;
    const er = normalizeRole(effectiveRole);
    const br = normalizeRole(backendRole);
    const isAdmin = br === 'admin' || er === 'admin' || normalizeIsAdmin(backendRole);
    if (!isAdmin && !canManageMatches(er) && !canManageMatches(br)) return false;
    if (isAdmin) return true;
    return canManageFacilityAssignmentForEvent({
      eventTeamSeasonId: activeTeamSeasonId,
      memberships: (memberships ?? [])
        .filter((m) => m.team_season_id)
        .map((m) => ({
          team_season_id: String(m.team_season_id),
          role: String(m.role ?? ''),
        })),
      clubTeamSeasonIds: payload?.clubTeamSeasonIds ?? [activeTeamSeasonId],
    });
  }, [activeTeamSeasonId, effectiveRole, backendRole, memberships, payload?.clubTeamSeasonIds]);

  const openFreeSlot = useCallback(
    (opts: { startMs: number; venueId: string; fieldId: string }) => {
      if (canCreateOccupancy) {
        setCreatePrefill({
          dayKey,
          startMs: opts.startMs,
          venueId: opts.venueId,
          fieldId: opts.fieldId,
        });
        return;
      }
      setFreeHint('Dieser Zeitraum ist frei.');
    },
    [canCreateOccupancy, dayKey],
  );

  const reload = useCallback(async () => {
    if (!activeTeamSeasonId) {
      setPayload(null);
      setError('Keine aktive Mannschaftssaison.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await loadAppPlatzDay({
        teamSeasonId: activeTeamSeasonId,
        dayKey,
        memberships: memberships ?? [],
        isPlatformAdmin: normalizeIsAdmin(backendRole),
      });
      setPayload(data);
      setError(data.error);
      setExpandedVenueIds((prev) => {
        if (prev.size > 0) return prev;
        return new Set((data.venues ?? []).map((v) => v.id));
      });
    } catch (err) {
      setPayload(null);
      setError(err instanceof Error ? err.message : 'Laden fehlgeschlagen.');
    } finally {
      setLoading(false);
    }
  }, [activeTeamSeasonId, dayKey, memberships, backendRole]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const venueSummaries = useMemo(() => {
    if (!payload) return new Map<string, ReturnType<typeof computeVenueDaySummary>>();
    const zoneMap = Object.fromEntries(
      Object.entries(payload.zonesByField).map(([fid, zones]) => [fid, buildZoneMetas(zones)]),
    );
    const map = new Map<string, ReturnType<typeof computeVenueDaySummary>>();
    for (const venue of payload.venues) {
      map.set(
        venue.id,
        computeVenueDaySummary({
          venueId: venue.id,
          venueName: venue.name,
          fields: payload.fields,
          dayKey,
          candidates: payload.candidates ?? [],
          zones: zoneMap,
        }),
      );
    }
    return map;
  }, [payload, dayKey]);

  if (!allowed) {
    return <Navigate to="/app/mehr" replace />;
  }

  const venues = payload?.venues ?? [];
  const fields = payload?.fields ?? [];
  const blocks = payload?.blocks ?? [];
  const candidates = payload?.candidates ?? [];
  const zonesByField = payload?.zonesByField ?? {};

  return (
    <div
      className="page app-platzbelegung min-h-[60vh] w-full px-3 pb-24 pt-4 sm:px-4"
      style={{
        background:
          'linear-gradient(180deg, rgba(40,5,5,0.97) 0%, rgba(20,0,0,0.98) 50%, rgba(10,0,0,0.99) 100%)',
      }}
    >
      <div className="mx-auto max-w-[640px] space-y-4">
        <header className="space-y-2">
          {sourceEventId ? (
            <button
              type="button"
              onClick={() => navigate(`/app/events/${encodeURIComponent(sourceEventId)}`)}
              className="inline-flex min-h-[40px] items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 text-[12px] font-semibold text-white"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden />
              Trainingscenter
            </button>
          ) : null}
          <h1 className="text-2xl font-bold tracking-tight text-white">Platzbelegung</h1>
          <p className="truncate text-[13px] text-white/55">{teamLabel}</p>

          <div className="flex items-center gap-2">
            <button
              type="button"
              className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-white/15 bg-white/5 text-white"
              aria-label="Vorheriger Tag"
              onClick={() => setDayKey((k) => shiftDayKey(k, -1))}
            >
              <ChevronLeft className="h-5 w-5" aria-hidden />
            </button>
            <div className="min-w-0 flex-1 text-center">
              <p className="text-[15px] font-semibold text-white">{formatDayHeader(dayKey)}</p>
              <button
                type="button"
                className="mt-0.5 text-[12px] font-medium text-red-300"
                onClick={() => setDayKey(todayKey)}
              >
                Heute
              </button>
            </div>
            <button
              type="button"
              className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-white/15 bg-white/5 text-white"
              aria-label="Nächster Tag"
              onClick={() => setDayKey((k) => shiftDayKey(k, 1))}
            >
              <ChevronRight className="h-5 w-5" aria-hidden />
            </button>
          </div>

          <div className="flex flex-wrap gap-2 text-[11px] font-medium">
            <span className={`rounded-full border px-2.5 py-1 ${statusChipClass('free')}`}>
              Grün = frei
            </span>
            <span className={`rounded-full border px-2.5 py-1 ${statusChipClass('partial')}`}>
              Gelb = teilweise
            </span>
            <span className={`rounded-full border px-2.5 py-1 ${statusChipClass('full')}`}>
              Rot = belegt
            </span>
          </div>
        </header>

        {loading ? (
          <p className="rounded-xl border border-white/10 bg-white/5 px-4 py-6 text-center text-sm text-white/60">
            Platzbelegung wird geladen…
          </p>
        ) : null}

        {!loading && error ? (
          <div className="space-y-3 rounded-xl border border-red-400/30 bg-red-950/40 px-4 py-4">
            <p className="text-sm text-red-100" role="alert">
              {error}
            </p>
            <button
              type="button"
              onClick={() => void reload()}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-xl border border-white/20 bg-white/10 px-4 text-sm font-semibold text-white"
            >
              <RefreshCw className="h-4 w-4" aria-hidden />
              Erneut versuchen
            </button>
          </div>
        ) : null}

        {!loading && !error && venues.length === 0 ? (
          <p className="rounded-xl border border-white/10 bg-white/5 px-4 py-6 text-center text-sm text-white/60">
            Für diese Mannschaft sind keine Anlagen für Training oder Heimspiel freigegeben.
          </p>
        ) : null}

        {!loading && venues.length > 0 && blocks.length === 0 ? (
          <p className="rounded-xl border border-emerald-400/20 bg-emerald-950/20 px-4 py-3 text-center text-[13px] text-emerald-100/80">
            Heute keine Belegungen auf den freigegebenen Plätzen.
          </p>
        ) : null}

        <div className="space-y-3">
          {venues.map((venue) => {
            const venueFields = fields.filter((f) => f.venue_id === venue.id);
            const summary = venueSummaries.get(venue.id);
            const open = expandedVenueIds.has(venue.id);
            return (
              <section
                key={venue.id}
                className="overflow-hidden rounded-2xl border border-white/12 bg-white/[0.04]"
              >
                <button
                  type="button"
                  className="flex w-full items-center justify-between gap-2 px-3 py-3 text-left"
                  onClick={() =>
                    setExpandedVenueIds((prev) => {
                      const next = new Set(prev);
                      if (next.has(venue.id)) next.delete(venue.id);
                      else next.add(venue.id);
                      return next;
                    })
                  }
                  aria-expanded={open}
                >
                  <span className="min-w-0">
                    <span className="flex items-center gap-2 text-[15px] font-semibold text-white">
                      <MapPin className="h-4 w-4 shrink-0 text-red-400" aria-hidden />
                      <span className="truncate">{venue.name}</span>
                    </span>
                    <span className="mt-0.5 block pl-6 text-[11px] text-white/45">
                      {venueFields.length} Platz{venueFields.length === 1 ? '' : 'e'}
                    </span>
                  </span>
                  {open ? (
                    <ChevronUp className="h-5 w-5 shrink-0 text-white/40" aria-hidden />
                  ) : (
                    <ChevronDown className="h-5 w-5 shrink-0 text-white/40" aria-hidden />
                  )}
                </button>

                {open ? (
                  <div className="space-y-3 border-t border-white/10 px-2 pb-3 pt-2">
                    {venueFields.map((field) => {
                      const fieldSummary = summary?.fields.find((f) => f.fieldId === field.id);
                      const status = fieldSummary?.currentStatus ?? 'free';
                      const fieldBlocks = blocks.filter((b) => b.fieldId === field.id);
                      const zoneMetas = buildZoneMetas(zonesByField[field.id] ?? []);
                      const slots = computeFieldDaySlots({
                        fieldId: field.id,
                        dayKey,
                        candidates,
                        zones: zoneMetas,
                        rangeStartHour: RANGE_START,
                        rangeEndHour: RANGE_END,
                      });
                      const nextLabel = fieldSummary?.nextOccupancyLabel ?? null;
                      const timelineWidth = (RANGE_END - RANGE_START) * PX_PER_HOUR;

                      return (
                        <div
                          key={field.id}
                          className="rounded-xl border border-white/10 bg-black/25 p-2.5"
                        >
                          <div className="mb-2 flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="truncate text-[14px] font-semibold text-white">
                                {field.name}
                              </p>
                              <p className="text-[11px] text-white/45">
                                {nextLabel ? `Nächste: ${nextLabel}` : 'Keine weitere Belegung'}
                              </p>
                            </div>
                            <span
                              className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${statusChipClass(status)}`}
                            >
                              {STATUS_LABELS[status]}
                            </span>
                          </div>

                          <div className="-mx-0.5 overflow-x-auto pb-1">
                            <div className="relative" style={{ width: timelineWidth, minWidth: '100%' }}>
                              <div className="relative mb-1 flex h-5 border-b border-white/10">
                                {Array.from({ length: RANGE_END - RANGE_START + 1 }, (_, i) => {
                                  const h = RANGE_START + i;
                                  return (
                                    <span
                                      key={h}
                                      className="absolute text-[9px] text-white/35"
                                      style={{
                                        left: `${(i / (RANGE_END - RANGE_START)) * 100}%`,
                                      }}
                                    >
                                      {String(h).padStart(2, '0')}
                                    </span>
                                  );
                                })}
                              </div>

                              <div className="relative h-16 rounded-lg bg-white/[0.03]">
                                {slots.map((slot) => {
                                  if (slot.status !== 'free') return null;
                                  const left = blockLeftPct(slot.startMs, dayKey);
                                  const width = blockWidthPct(slot.startMs, slot.endMs, dayKey);
                                  return (
                                    <button
                                      key={`${slot.startMs}`}
                                      type="button"
                                      title="Frei – Belegung anlegen"
                                      className="absolute top-1 bottom-1 rounded bg-emerald-500/15 hover:bg-emerald-500/25"
                                      style={{ left: `${left}%`, width: `${width}%` }}
                                      onClick={() =>
                                        openFreeSlot({
                                          startMs: slot.startMs,
                                          venueId: venue.id,
                                          fieldId: field.id,
                                        })
                                      }
                                    />
                                  );
                                })}

                                {fieldBlocks.map((block) => {
                                  const left = blockLeftPct(block.startsAtMs, dayKey);
                                  const width = blockWidthPct(
                                    block.startsAtMs,
                                    block.endsAtMs,
                                    dayKey,
                                  );
                                  const unclear = block.spatial.geometryUnclear;
                                  const full = block.spatial.status === 'full';
                                  return (
                                    <button
                                      key={block.id}
                                      type="button"
                                      onClick={() => setDetail(block)}
                                      className={[
                                        'absolute top-1 bottom-1 z-10 overflow-hidden rounded-md border px-1 text-left',
                                        unclear
                                          ? 'border-dashed border-amber-300/70 bg-amber-500/20'
                                          : full
                                            ? 'border-red-300/50 bg-red-500/35'
                                            : 'border-amber-300/50 bg-amber-500/25',
                                      ].join(' ')}
                                      style={{ left: `${left}%`, width: `${Math.max(width, 8)}%` }}
                                    >
                                      <span className="block truncate text-[10px] font-semibold text-white">
                                        {block.timeLabel}
                                      </span>
                                      <span className="block truncate text-[9px] text-white/75">
                                        {block.teamLabel}
                                      </span>
                                    </button>
                                  );
                                })}
                              </div>
                            </div>
                          </div>

                          {fieldBlocks[0] ? (
                            <div className="mt-2 flex items-center gap-2">
                              <FieldOccupancyMiniMap
                                segments={fieldBlocks[0].spatial.segments}
                                orientation="landscape"
                                className="h-10 w-16 shrink-0"
                              />
                              <p className="text-[11px] text-white/50">
                                {fieldBlocks[0].spatial.geometryUnclear
                                  ? 'Geometrie unklar – Status nicht als frei werten'
                                  : fieldBlocks.length === 1
                                    ? fieldBlocks[0].zoneLabel
                                    : `${fieldBlocks.length} Belegungen`}
                              </p>
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                ) : null}
              </section>
            );
          })}
        </div>
      </div>

      <Modal
        isOpen={Boolean(detail)}
        title="Belegungsdetails"
        onClose={() => setDetail(null)}
        footer={
          detail?.canEdit && !detail.isSharedForeign ? (
            <button
              type="button"
              className="min-h-[46px] w-full rounded-xl bg-red-600 px-4 text-sm font-semibold text-white"
              onClick={() => {
                const id = detail.eventId;
                setDetail(null);
                navigate(`/app/events/${id}`);
              }}
            >
              Termin öffnen
            </button>
          ) : (
            <button
              type="button"
              className="min-h-[46px] w-full rounded-xl border border-white/20 bg-white/10 px-4 text-sm font-semibold text-white"
              onClick={() => setDetail(null)}
            >
              Schließen
            </button>
          )
        }
      >
        {detail ? (
          <div className="space-y-3 text-[14px] text-white/85">
            <div className="flex flex-wrap gap-2">
              <span className="rounded-full bg-white/10 px-2.5 py-0.5 text-[11px] font-semibold">
                {detail.kindLabel}
              </span>
              {detail.isSharedForeign || !detail.canEdit ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-slate-500/30 px-2.5 py-0.5 text-[11px] font-semibold text-white/80">
                  <Eye className="h-3 w-3" aria-hidden />
                  Nur ansehen
                </span>
              ) : null}
              <span
                className={`rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${statusChipClass(detail.spatial.status)}`}
              >
                {detail.spatial.geometryUnclear
                  ? 'Status unklar'
                  : detail.spatial.status === 'full'
                    ? 'Voll belegt'
                    : 'Teilbelegt'}
              </span>
            </div>
            <DetailRow label="Mannschaft" value={detail.teamLabel} />
            <DetailRow label="Datum" value={detail.dayLabel} />
            <DetailRow label="Zeitraum" value={detail.timeLabel} />
            <DetailRow label="Sportanlage" value={detail.venueName} />
            <DetailRow label="Platz" value={detail.fieldName} />
            <DetailRow label="Teilfläche" value={detail.zoneLabel} />
            <FieldOccupancyMiniMap
              segments={detail.spatial.segments}
              orientation="landscape"
              showLabels
              className="h-24 w-full"
            />
            <p className="text-[12px] text-white/45">{detail.label}</p>
          </div>
        ) : null}
      </Modal>

      <Modal isOpen={Boolean(freeHint)} title="Freier Zeitraum" onClose={() => setFreeHint(null)}>
        <p className="text-sm text-white/80">{freeHint}</p>
      </Modal>

      {createPrefill && payload?.clubId && activeTeamSeasonId ? (
        <AppCreateOccupancyModal
          open={Boolean(createPrefill)}
          clubId={payload.clubId}
          teamSeasonId={activeTeamSeasonId}
          teamLabel={teamLabel}
          canCreate={canCreateOccupancy}
          fields={fields}
          zonesByField={zonesByField}
          prefill={createPrefill}
          onClose={() => setCreatePrefill(null)}
          onCreated={async () => {
            setCreatePrefill(null);
            await reload();
          }}
        />
      ) : null}
    </div>
  );
};

function DetailRow({ label, value }: { label: string; value: string }): React.ReactElement {
  return (
    <div className="flex justify-between gap-3 border-b border-white/8 py-1.5">
      <span className="text-white/45">{label}</span>
      <span className="text-right font-medium text-white">{value}</span>
    </div>
  );
}

function normalizeIsAdmin(backendRole: string | null | undefined): boolean {
  return (backendRole ?? '').trim().toLowerCase() === 'admin';
}
