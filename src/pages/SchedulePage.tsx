import React, { useMemo, useState, useEffect } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Button } from '../app/components/ui/Button';
import { Modal } from '../app/ui/Modal';
import { CreateEventModal } from '../app/components/CreateEventModal';
import { MatchCardLigaportal } from '../app/components/MatchCardLigaportal';
import { useActiveTeamSeason } from '../hooks/useActiveTeamSeason';
import { usePublicTeamSeason } from '../hooks/usePublicTeamSeason';
import { useEvents, type EventRow } from '../hooks/useEvents';
import { useEventsAttendance } from '../hooks/useEventsAttendance';
import { usePlayers } from '../hooks/usePlayers';
import { useAvailabilityPermissions } from '../hooks/useAvailabilityPermissions';
import { useSession, getTeamNameFromMembership, getSeasonLabelFromMembership } from '../auth/useSession';
import { normalizeRole, canManageMatches, canSeeMeetup } from '../lib/roles';
import { getOurTeamDisplayName } from '../lib/teamLogos';
import { supabase } from '../lib/supabaseClient';

type TabId = 'upcoming' | 'live' | 'finished';

const TAB_OPTIONS: { id: TabId; label: string }[] = [
  { id: 'upcoming', label: 'Bevorstehend' },
  { id: 'live', label: 'Live' },
  { id: 'finished', label: 'Beendet' },
];

function getEventTab(e: EventRow): TabId {
  const s = e.status ?? 'upcoming';
  if (s === 'live') return 'live';
  if (s === 'finished' || s === 'canceled') return 'finished';
  return 'upcoming';
}

/** ISO-String → Wert für input type="datetime-local" (lokale Zeit). */
function isoToDateTimeLocal(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  const y = d.getFullYear();
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const h = String(d.getHours()).padStart(2, '0');
  const min = String(d.getMinutes()).padStart(2, '0');
  return `${y}-${mo}-${day}T${h}:${min}`;
}


export const SchedulePage: React.FC = () => {
  const navigate = useNavigate();
  const { teamLabel, teamSeasonId, role: roleFromHook, loading: tsLoading, error: tsError } =
    useActiveTeamSeason();
  const { teamSeasonId: publicTeamId, teamLabel: publicLabel, loading: publicLoading } =
    usePublicTeamSeason();
  const { selectedMembership, previewRole } = useSession();
  const effectiveTeamSeasonId = teamSeasonId ?? publicTeamId;
  const { events, loading: eLoading, error: eError, refetch } = useEvents(effectiveTeamSeasonId);

  const loading = tsLoading || (!teamSeasonId && publicLoading);

  const teamSeasonSubtitle = (() => {
    if (selectedMembership) {
      const teamName = getTeamNameFromMembership(selectedMembership)?.trim();
      const season = getSeasonLabelFromMembership(selectedMembership)?.trim();
      if (teamName && (season && season !== '—')) return `${teamName} (${season})`;
      if (teamName) return teamName;
    }
    return publicLabel ?? teamLabel ?? 'Spielplan';
  })();

  // Public Mode: /schedule und /live = nur Anzeige, KEINE Navigation zu Event-Detail
  const { pathname } = useLocation();
  const forcePublicView =
    pathname === '/schedule' || pathname === '/live' || !pathname.startsWith('/app');
  const backendRole = normalizeRole(roleFromHook);
  const uiRole = forcePublicView ? null : (previewRole ?? backendRole ?? null);
  const normalizedUiRole = normalizeRole(uiRole);
  const canManage = forcePublicView ? false : canManageMatches(normalizedUiRole);
  const showMeetupForRole = forcePublicView ? true : canSeeMeetup(normalizedUiRole); // Öffentlich: Treffpunkt für alle
  const ourTeamName = teamLabel ?? publicLabel ?? getOurTeamDisplayName();

  const [activeTab, setActiveTab] = useState<TabId>('upcoming');
  const [createModalOpen, setCreateModalOpen] = useState(false);

  /** Zu-/Absage: Modal + Status. Gespeichertes Event = genau das angeklickte Spiel (ID-Konsistenz). */
  const [attendanceModalEvent, setAttendanceModalEvent] = useState<EventRow | null>(null);
  const [attendanceStatusByEventId, setAttendanceStatusByEventId] = useState<Record<string, 'yes' | 'no'>>({});

  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editEvent, setEditEvent] = useState<EventRow | null>(null);
  const [editOpponent, setEditOpponent] = useState('');
  const [editDateTime, setEditDateTime] = useState('');
  const [editLocation, setEditLocation] = useState('');
  const [editMeetupAt, setEditMeetupAt] = useState('');
  const [editError, setEditError] = useState<string | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!toastMessage) return;
    const t = setTimeout(() => setToastMessage(null), 3000);
    return () => clearTimeout(t);
  }, [toastMessage]);

  useEffect(() => {
    if (pathname === '/live') setActiveTab('live');
  }, [pathname]);

  const openEditModal = (e: EventRow) => {
    if (!canManage) {
      setToastMessage('Keine Berechtigung zum Bearbeiten.');
      return;
    }
    setEditEvent(e);
    setEditOpponent(e.opponent ?? '');
    setEditDateTime(isoToDateTimeLocal(e.starts_at));
    setEditLocation(e.location ?? '');
    setEditMeetupAt(isoToDateTimeLocal(e.meetup_at));
    setEditError(null);
    setEditModalOpen(true);
  };

  /**
   * Speichert Zusage/Absage in event_attendance (event_id, player_id, status).
   * Verwendet angeklicktes Spiel + verknüpften Spieler (player_guardians).
   */
  const setAttendance = async (eventId: string, status: 'yes' | 'no') => {
    let playerId = myAttendancePlayerIds[0] ?? null;
    if (!playerId) {
      const { data: userRes } = await supabase.auth.getUser();
      const userId = userRes?.user?.id;
      if (userId) {
        const byUser = await supabase.from('player_guardians').select('player_id').eq('user_id', userId);
        console.log('[PLAYER GUARDIAN LOOKUP RESULT]', { data: byUser.data, error: byUser.error });
        if (!byUser.error && byUser.data?.length) {
          playerId = byUser.data[0].player_id;
        }
      }
    }

    if (!eventId || !playerId) {
      console.error('[ATTENDANCE MISSING IDS]', { eventId, playerId });
      setToastMessage(!playerId ? 'Kein Spieler zugeordnet.' : 'Event fehlt.');
      setAttendanceModalEvent(null);
      return;
    }

    console.log('[ATTENDANCE SAVE START]', { eventId, playerId, status });

    const result = await supabase
      .from('event_attendance')
      .upsert(
        { event_id: eventId, player_id: playerId, status },
        { onConflict: 'event_id,player_id' }
      )
      .select('event_id, player_id, status');

    console.log('[ATTENDANCE SAVE RESULT]', { data: result.data, error: result.error });

    if (result.error) {
      console.error('[ATTENDANCE SAVE ERROR]', result.error);
      setToastMessage(result.error.message ?? 'Speichern fehlgeschlagen.');
      setAttendanceModalEvent(null);
      return;
    }

    setAttendanceStatusByEventId((prev) => ({ ...prev, [eventId]: status }));
    setAttendanceModalEvent(null);
    await refreshAttendance();
  };

  const closeEditModal = () => {
    setEditModalOpen(false);
    setEditEvent(null);
    setEditOpponent('');
    setEditDateTime('');
    setEditLocation('');
    setEditMeetupAt('');
    setEditError(null);
  };

  const handleEditSubmit = async (ev: React.FormEvent) => {
    ev.preventDefault();
    if (!editEvent) return;
    const opponent = editOpponent.trim();
    if (!editDateTime.trim()) {
      setEditError('Beginn ist Pflicht.');
      return;
    }
    setEditError(null);
    setSavingEdit(true);
    const startsAt = new Date(editDateTime.trim()).toISOString();
    const locationVal = editLocation.trim() || null;
    const meetupAt = editMeetupAt.trim() ? new Date(editMeetupAt.trim()).toISOString() : null;

    const eventPayload = {
      opponent: opponent || null,
      starts_at: startsAt,
      location: locationVal,
      meetup_at: meetupAt,
    };
    const { error: eventErr } = await supabase
      .from('events')
      .update(eventPayload)
      .eq('id', editEvent.id);

    if (eventErr) {
      setEditError(eventErr.message);
      setSavingEdit(false);
      return;
    }
    setSavingEdit(false);
    closeEditModal();
    await refetch();
  };

  const handleDelete = async (event: EventRow) => {
    if (!window.confirm('Termin wirklich löschen?')) return;
    const { error } = await supabase.from('events').delete().eq('id', event.id);
    if (error) {
      alert(error.message);
      return;
    }
    await refetch();
  };

  const displayEvents = useMemo(() => {
    const sorted = [...events].sort((a, b) => (a.starts_at ?? '').localeCompare(b.starts_at ?? ''));
    return sorted.filter((e) => getEventTab(e) === activeTab);
  }, [events, activeTab]);

  const displayEventIds = useMemo(() => displayEvents.map((e) => e.id), [displayEvents]);
  const { byEventId: attendanceByEventId, loading: attendanceLoading, refresh: refreshAttendance } = useEventsAttendance(displayEventIds);
  const { players } = usePlayers(effectiveTeamSeasonId);
  const { myAttendancePlayerIds } = useAvailabilityPermissions({
    role: normalizedUiRole,
    teamSeasonId,
  });

  const rosterSize = players.length;

  const pageLoading = loading || eLoading;
  const error = tsError ?? eError;

  return (
    <div className="page schedule-page relative min-h-[60vh] [background:linear-gradient(180deg,rgba(40,5,5,0.97)_0%,rgba(20,0,0,0.98)_50%,rgba(10,0,0,0.99)_100%)] [box-shadow:inset_0_0_120px_rgba(120,20,20,0.12)]">
      <div className="w-full px-[6px] sm:px-4">
        <div className="max-w-[720px] mx-auto space-y-5 pt-4 mt-2">
          {toastMessage && (
            <div
              className="fixed top-4 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-2xl bg-black/90 border border-red-900/80 text-white text-sm font-medium shadow-lg backdrop-blur-sm"
              role="alert"
            >
              {toastMessage}
            </div>
          )}
          {forcePublicView && (
            <Link
              to="/"
              className="mb-2 inline-block text-sm text-white/70 hover:text-white transition-colors"
            >
              ← Start
            </Link>
          )}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h1 className="text-4xl font-bold text-white tracking-tight [text-shadow:0_1px_2px_rgba(0,0,0,0.5)]">
                Spielplan
              </h1>
              <p className="text-sm text-white/70 mt-2">
                {teamSeasonSubtitle}
              </p>
            </div>
            {canManage && (
              <Button
                variant="primary"
                size="sm"
                className="rounded-xl border border-red-500/30 bg-red-500/15 shadow-[0_0_20px_rgba(255,0,0,0.20)] hover:bg-red-500/25"
                onClick={() => setCreateModalOpen(true)}
                disabled={!teamSeasonId}
              >
                Spiel anlegen
              </Button>
            )}
          </div>

          <div className="flex gap-1.5 rounded-xl border border-red-900/40 bg-black/25 p-1.5 backdrop-blur-sm">
            {TAB_OPTIONS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={`flex-1 py-2 px-3 rounded-xl text-sm font-medium transition-colors ${
                  activeTab === tab.id
                    ? 'bg-red-500/15 text-white border border-red-500/30 shadow-[0_0_20px_rgba(255,0,0,0.20)]'
                    : 'text-white/70 hover:text-white/90 border border-transparent'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {pageLoading && <p className="text-sm text-[var(--muted)]">Lade Spielplan…</p>}
          {error && (
            <p className="text-sm text-red-600" role="alert">
              {error}
            </p>
          )}

          {!pageLoading && !error && (
            <>
              {displayEvents.length === 0 ? (
                <p className="text-sm text-[var(--text-sub)]">
                  {events.length === 0
                    ? 'Noch keine Spiele oder Termine für diese Mannschaft erfasst.'
                    : `Keine Einträge in „${TAB_OPTIONS.find((t) => t.id === activeTab)?.label ?? activeTab}".`}
                </p>
              ) : (
                displayEvents.map((ev) => {
                  const evAttendance = attendanceByEventId[ev.id];
                  const yes = evAttendance?.yes ?? 0;
                  const no = evAttendance?.no ?? 0;
                  const open = Math.max(0, rosterSize - yes - no);
                  const myPlayerIdKey = (myAttendancePlayerIds[0] ?? '').toLowerCase();
                  const myStatusFromDb =
                    (uiRole === 'parent' || uiRole === 'player') && myAttendancePlayerIds[0] && evAttendance?.availabilityByPlayerId[myPlayerIdKey];
                  const attendanceStatusMerged =
                    (uiRole === 'parent' || uiRole === 'player')
                      ? (myStatusFromDb ?? attendanceStatusByEventId[ev.id] ?? null)
                      : undefined;
                  return (
                    <div
                      key={ev.id}
                      className="w-full mb-6"
                      {...(forcePublicView
                        ? {
                            onClick: (e: React.MouseEvent) => {
                              e.preventDefault();
                              e.stopPropagation();
                            },
                            style: { cursor: 'default' as const },
                            role: 'presentation',
                          }
                        : {})}
                    >
                      <MatchCardLigaportal
                        className="w-full max-w-none rounded-2xl"
                        ourTeamName={ourTeamName}
                        opponent={ev.opponent}
                        isHome={ev.is_home}
                        startsAt={ev.starts_at}
                        status={ev.status}
                        kind={ev.kind}
                        matchType={ev.match_type}
                        location={ev.location}
                        meetupAt={ev.meetup_at}
                        showMeetup={showMeetupForRole}
                        eventId={forcePublicView ? undefined : ev.id}
                        onNavigate={forcePublicView ? undefined : (id) => navigate(`/app/events/${id}`)}
                        isPublicView={forcePublicView}
                        opponentSlug={ev.opponent_slug}
                        opponentLogoUrl={ev.opponent_logo_url}
                        canManage={canManage}
                        onEdit={canManage ? () => openEditModal(ev) : undefined}
                        onDelete={canManage ? () => handleDelete(ev) : undefined}
                        role={uiRole ?? undefined}
                        attendanceStatus={attendanceStatusMerged}
                        onOpenAttendance={(uiRole === 'parent' || uiRole === 'player') ? () => setAttendanceModalEvent(ev) : undefined}
                        attendanceCounts={canManage ? { yes, no, open } : undefined}
                      />
                    </div>
                  );
                })
              )}
            </>
          )}

          <CreateEventModal
            isOpen={createModalOpen}
            onClose={() => setCreateModalOpen(false)}
            teamSeasonId={teamSeasonId}
            onSuccess={refetch}
            eventType="match"
          />

          <Modal
            isOpen={editModalOpen}
            title="Termin bearbeiten"
            onClose={closeEditModal}
            footer={
              <div className="flex justify-end gap-2">
                <Button variant="ghost" onClick={closeEditModal}>
                  Abbrechen
                </Button>
                <Button
                  type="submit"
                  form="edit-event-form"
                  variant="primary"
                  disabled={savingEdit}
                >
                  {savingEdit ? 'Speichern…' : 'Speichern'}
                </Button>
              </div>
            }
          >
            <form id="edit-event-form" onSubmit={handleEditSubmit} className="space-y-4">
              <div>
                <label htmlFor="edit-opponent" className="block text-sm font-medium text-[var(--text-main)] mb-1">
              Gegner / Bezeichnung
            </label>
            <input
              id="edit-opponent"
              type="text"
              value={editOpponent}
              onChange={(e) => setEditOpponent(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-[var(--glass-border)] bg-[var(--glass-bg)] text-[var(--text-main)]"
            />
          </div>
          <div>
            <label htmlFor="edit-datetime" className="block text-sm font-medium text-[var(--text-main)] mb-1">
              Beginn *
            </label>
            <input
              id="edit-datetime"
              type="datetime-local"
              required
              value={editDateTime}
              onChange={(e) => setEditDateTime(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-[var(--glass-border)] bg-[var(--glass-bg)] text-[var(--text-main)]"
            />
          </div>
          <div>
            <label htmlFor="edit-location" className="block text-sm font-medium text-[var(--text-main)] mb-1">
              Ort (optional)
            </label>
            <input
              id="edit-location"
              type="text"
              value={editLocation}
              onChange={(e) => setEditLocation(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-[var(--glass-border)] bg-[var(--glass-bg)] text-[var(--text-main)]"
              placeholder="z. B. Heimspielplatz"
            />
          </div>
          <div>
            <label htmlFor="edit-meetup_at" className="block text-sm font-medium text-[var(--text-main)] mb-1">
              Treffpunkt (optional)
            </label>
            <input
              id="edit-meetup_at"
              type="datetime-local"
              value={editMeetupAt}
              onChange={(e) => setEditMeetupAt(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-[var(--glass-border)] bg-[var(--glass-bg)] text-[var(--text-main)]"
            />
          </div>
          {editError && (
            <p className="text-sm text-red-600" role="alert">
              {editError}
            </p>
          )}
            </form>
          </Modal>

          {/* Modal Zu-/Absage (Eltern/Spieler) – verwendet exakt die event_id des angeklickten Spiels. */}
          <Modal
            isOpen={attendanceModalEvent != null}
            title={attendanceModalEvent ? `Zu-/Absage: ${attendanceModalEvent.opponent ?? 'Termin'}` : 'Zu-/Absage'}
            onClose={() => setAttendanceModalEvent(null)}
            footer={
              <div className="flex justify-end">
                <Button variant="ghost" onClick={() => setAttendanceModalEvent(null)}>
                  Schließen
                </Button>
              </div>
            }
          >
            <div className="flex flex-col py-3">
              {attendanceModalEvent && (
                <p className="text-sm text-[var(--text-sub)] mb-2">
                  {attendanceModalEvent.opponent ?? 'Termin'} · {attendanceModalEvent.starts_at ? new Date(attendanceModalEvent.starts_at).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''}
                </p>
              )}
              <p className="text-sm text-[var(--text-sub)]">
                Bitte gib deine Verfügbarkeit an.
              </p>
              <div className="flex flex-wrap gap-3 mt-6">
                <button
                  type="button"
                  onClick={() => {
                    console.log('[ATTENDANCE BUTTON CLICKED]');
                    if (!attendanceModalEvent) return;
                    setAttendance(attendanceModalEvent.id, 'yes').catch((e) => console.error('[ATTENDANCE]', e));
                  }}
                  className="flex-1 min-w-0 max-w-[240px] mx-auto sm:max-w-none rounded-xl py-3 px-5 text-sm font-semibold text-white bg-green-600 hover:bg-green-500 active:scale-[0.98] transition-all"
                >
                  Zusagen
                </button>
                <button
                  type="button"
                  onClick={() => {
                    console.log('[ATTENDANCE BUTTON CLICKED]');
                    if (!attendanceModalEvent) return;
                    setAttendance(attendanceModalEvent.id, 'no').catch((e) => console.error('[ATTENDANCE]', e));
                  }}
                  className="flex-1 min-w-0 max-w-[240px] mx-auto sm:max-w-none rounded-xl py-3 px-5 text-sm font-semibold text-white bg-red-600 hover:bg-red-500 active:scale-[0.98] transition-all"
                >
                  Absagen
                </button>
              </div>
            </div>
          </Modal>
        </div>
      </div>
    </div>
  );
};
