import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Car,
  ChevronDown,
  ChevronUp,
  Clock3,
  MapPin,
  MessageCircle,
  Minus,
  Pencil,
  Plus,
  RotateCcw,
  Trash2,
  UserPlus,
  Users,
} from 'lucide-react';
import { supabase } from '../../lib/supabaseClient';
import { profileDisplayName, useProfile } from '../../auth/useProfile';
import { meetupUtcIsoOnViennaEventDay, utcIsoToViennaTimeHHmm } from '../../lib/viennaTime';
import type { PlayerItem } from '../../hooks/usePlayers';
import { Card } from '../../app/components/ui/Card';
import { Modal } from '../../app/ui/Modal';
import { dsPrimaryCtaClass, dsSecondaryCtaClass } from '../../lib/premiumDesignSystem';

type CarpoolOffer = {
  id: string;
  event_id: string;
  driver_user_id: string;
  driver_name: string;
  departure_at: string;
  departure_location: string;
  seat_count: number;
  return_included: boolean;
  note: string | null;
};

type CarpoolReservation = {
  id: string;
  event_id: string;
  offer_id: string;
  player_id: string;
  reserved_by: string;
};

type CarpoolRequest = {
  id: string;
  event_id: string;
  player_id: string;
  requested_by: string;
};

type PlayerChoice = { id: string; name: string };

type Props = {
  eventId: string;
  eventStartsAt: string;
  meetingAt?: string | null;
  defaultLocation?: string | null;
  currentUserId: string;
  myPlayerIds: string[];
  players: PlayerItem[];
  canOffer: boolean;
  canManage?: boolean;
};

function playerName(player: PlayerItem | undefined): string {
  if (!player) return 'Spieler';
  return (
    (player.display_name ?? '').trim() ||
    [player.first_name, player.last_name].filter(Boolean).join(' ').trim() ||
    'Spieler'
  );
}

function friendlyError(value: unknown): string {
  const raw = value instanceof Error ? value.message : String(value ?? 'Unbekannter Fehler');
  if (/relation .*event_carpool|schema cache|does not exist/i.test(raw)) {
    return 'Die Fahrgemeinschaft ist in der Datenbank noch nicht aktiviert.';
  }
  if (/bereits voll/i.test(raw)) return 'Diese Fahrgemeinschaft ist inzwischen voll.';
  if (/duplicate key|23505/i.test(raw)) return 'Für dieses Kind besteht bereits eine Reservierung oder ein Platzgesuch.';
  return raw;
}

function timeLabel(iso: string): string {
  try {
    return new Intl.DateTimeFormat('de-AT', {
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'Europe/Vienna',
    }).format(new Date(iso));
  } catch {
    return '—';
  }
}

export const EventCarpoolCard: React.FC<Props> = ({
  eventId,
  eventStartsAt,
  meetingAt,
  defaultLocation,
  currentUserId,
  myPlayerIds,
  players,
  canOffer,
  canManage = false,
}) => {
  const { profile } = useProfile(currentUserId);
  const [offers, setOffers] = useState<CarpoolOffer[]>([]);
  const [reservations, setReservations] = useState<CarpoolReservation[]>([]);
  const [requests, setRequests] = useState<CarpoolRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expanded, setExpanded] = useState(true);
  const [offerModalOpen, setOfferModalOpen] = useState(false);
  const [editingOffer, setEditingOffer] = useState<CarpoolOffer | null>(null);
  const [offerTime, setOfferTime] = useState('');
  const [offerLocation, setOfferLocation] = useState('');
  const [offerSeats, setOfferSeats] = useState('3');
  const [offerReturn, setOfferReturn] = useState(true);
  const [offerNote, setOfferNote] = useState('');
  const [playerAction, setPlayerAction] = useState<
    { kind: 'reserve'; offerId: string } | { kind: 'request' } | null
  >(null);
  const [selectedPlayerId, setSelectedPlayerId] = useState('');

  const changeOfferSeats = (delta: number) => {
    const current = Number.parseInt(offerSeats, 10);
    const next = Math.min(12, Math.max(1, (Number.isFinite(current) ? current : 1) + delta));
    setOfferSeats(String(next));
  };

  const playerById = useMemo(
    () => new Map(players.map((player) => [player.id, player])),
    [players],
  );
  const myPlayers = useMemo<PlayerChoice[]>(
    () =>
      myPlayerIds
        .map((id) => ({ id, name: playerName(playerById.get(id)) }))
        .sort((a, b) => a.name.localeCompare(b.name, 'de-AT')),
    [myPlayerIds, playerById],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [offerResult, reservationResult, requestResult] = await Promise.all([
        supabase
          .from('event_carpool_offers')
          .select('id,event_id,driver_user_id,driver_name,departure_at,departure_location,seat_count,return_included,note')
          .eq('event_id', eventId)
          .order('departure_at', { ascending: true }),
        supabase
          .from('event_carpool_reservations')
          .select('id,event_id,offer_id,player_id,reserved_by')
          .eq('event_id', eventId),
        supabase
          .from('event_carpool_requests')
          .select('id,event_id,player_id,requested_by')
          .eq('event_id', eventId),
      ]);
      if (offerResult.error) throw offerResult.error;
      if (reservationResult.error) throw reservationResult.error;
      if (requestResult.error) throw requestResult.error;
      setOffers((offerResult.data ?? []) as CarpoolOffer[]);
      setReservations((reservationResult.data ?? []) as CarpoolReservation[]);
      setRequests((requestResult.data ?? []) as CarpoolRequest[]);
    } catch (cause) {
      setError(friendlyError(cause));
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    void load();
  }, [load]);

  const ownOffer = offers.find((offer) => offer.driver_user_id === currentUserId) ?? null;
  const totalFreeSeats = offers.reduce((sum, offer) => {
    const used = reservations.filter((row) => row.offer_id === offer.id).length;
    return sum + Math.max(0, offer.seat_count - used);
  }, 0);

  const openOfferModal = (offer?: CarpoolOffer) => {
    const current = offer ?? null;
    setEditingOffer(current);
    setOfferTime(
      current
        ? utcIsoToViennaTimeHHmm(current.departure_at)
        : meetingAt
          ? utcIsoToViennaTimeHHmm(meetingAt)
          : utcIsoToViennaTimeHHmm(eventStartsAt),
    );
    setOfferLocation(current?.departure_location ?? defaultLocation?.trim() ?? '');
    setOfferSeats(String(current?.seat_count ?? 3));
    setOfferReturn(current?.return_included ?? true);
    setOfferNote(current?.note ?? '');
    setError(null);
    setOfferModalOpen(true);
  };

  const saveOffer = async () => {
    const seatCount = Number.parseInt(offerSeats, 10);
    if (!/^\d{2}:\d{2}$/.test(offerTime)) {
      setError('Bitte eine gültige Abfahrtszeit eingeben.');
      return;
    }
    if (!offerLocation.trim()) {
      setError('Bitte einen Abfahrtsort eingeben.');
      return;
    }
    if (!Number.isFinite(seatCount) || seatCount < 1 || seatCount > 12) {
      setError('Bitte 1 bis 12 freie Plätze angeben.');
      return;
    }
    setBusy(true);
    setError(null);
    const payload = {
      departure_at: meetupUtcIsoOnViennaEventDay(eventStartsAt, offerTime),
      departure_location: offerLocation.trim(),
      seat_count: seatCount,
      return_included: offerReturn,
      note: offerNote.trim() || null,
    };
    const result = editingOffer
      ? await supabase.from('event_carpool_offers').update(payload).eq('id', editingOffer.id)
      : await supabase.from('event_carpool_offers').insert({
          ...payload,
          event_id: eventId,
          driver_user_id: currentUserId,
          driver_name: profileDisplayName(profile) ?? 'Familie',
        });
    setBusy(false);
    if (result.error) {
      setError(friendlyError(result.error));
      return;
    }
    setOfferModalOpen(false);
    await load();
  };

  const deleteOffer = async (offer: CarpoolOffer) => {
    const count = reservations.filter((row) => row.offer_id === offer.id).length;
    const message = count
      ? `Fahrt wirklich löschen? ${count} reservierte${count === 1 ? 'r' : ''} Platz${count === 1 ? '' : 'e'} werden storniert.`
      : 'Fahrt wirklich löschen?';
    if (!window.confirm(message)) return;
    setBusy(true);
    const { error: deleteError } = await supabase.from('event_carpool_offers').delete().eq('id', offer.id);
    setBusy(false);
    if (deleteError) {
      setError(friendlyError(deleteError));
      return;
    }
    await load();
  };

  const openPlayerAction = (action: typeof playerAction) => {
    if (!action) return;
    const candidates = myPlayers.filter((player) => {
      if (action.kind === 'reserve') {
        return !reservations.some((row) => row.player_id === player.id);
      }
      return (
        !requests.some((row) => row.player_id === player.id) &&
        !reservations.some((row) => row.player_id === player.id)
      );
    });
    setSelectedPlayerId(candidates[0]?.id ?? '');
    setPlayerAction(action);
    setError(null);
  };

  const confirmPlayerAction = async () => {
    if (!playerAction || !selectedPlayerId) return;
    setBusy(true);
    setError(null);
    const result =
      playerAction.kind === 'reserve'
        ? await supabase.from('event_carpool_reservations').insert({
            event_id: eventId,
            offer_id: playerAction.offerId,
            player_id: selectedPlayerId,
            reserved_by: currentUserId,
          })
        : await supabase.from('event_carpool_requests').insert({
            event_id: eventId,
            player_id: selectedPlayerId,
            requested_by: currentUserId,
          });
    if (!result.error && playerAction.kind === 'reserve') {
      await supabase
        .from('event_carpool_requests')
        .delete()
        .eq('event_id', eventId)
        .eq('player_id', selectedPlayerId);
    }
    setBusy(false);
    if (result.error) {
      setError(friendlyError(result.error));
      return;
    }
    setPlayerAction(null);
    await load();
  };

  const cancelReservation = async (row: CarpoolReservation) => {
    setBusy(true);
    const { error: deleteError } = await supabase
      .from('event_carpool_reservations')
      .delete()
      .eq('id', row.id);
    setBusy(false);
    if (deleteError) setError(friendlyError(deleteError));
    else await load();
  };

  const cancelRequest = async (row: CarpoolRequest) => {
    setBusy(true);
    const { error: deleteError } = await supabase.from('event_carpool_requests').delete().eq('id', row.id);
    setBusy(false);
    if (deleteError) setError(friendlyError(deleteError));
    else await load();
  };

  const playerActionCandidates = myPlayers.filter((player) => {
    if (playerAction?.kind === 'reserve') return !reservations.some((row) => row.player_id === player.id);
    return (
      !requests.some((row) => row.player_id === player.id) &&
      !reservations.some((row) => row.player_id === player.id)
    );
  });

  return (
    <>
      <Card className="sz-club-surface sz-club-surface--hero flex flex-col gap-3 border">
        <button
          type="button"
          className="flex min-h-[44px] w-full items-center gap-3 text-left"
          onClick={() => setExpanded((value) => !value)}
          aria-expanded={expanded}
        >
          <span className="sz-club-accent-text flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.04]">
            <Car className="h-5 w-5" strokeWidth={2.1} aria-hidden />
          </span>
          <span className="min-w-0 flex-1">
            <span className="sz-club-accent-text block text-[15px] font-bold uppercase tracking-[0.12em]">Fahrgemeinschaft</span>
            <span className="mt-1 block text-[14px] font-medium text-white/68">
              {loading
                ? 'Wird geladen…'
                : totalFreeSeats > 0
                  ? `${totalFreeSeats} ${totalFreeSeats === 1 ? 'Platz' : 'Plätze'} frei`
                  : offers.length > 0
                    ? 'Alle Fahrten voll'
                    : requests.length > 0
                      ? `${requests.length} ${requests.length === 1 ? 'Platz wird' : 'Plätze werden'} gesucht`
                      : 'Fahrt anbieten oder Platz suchen'}
            </span>
          </span>
          {expanded ? <ChevronUp className="h-5 w-5 text-white/45" /> : <ChevronDown className="h-5 w-5 text-white/45" />}
        </button>

        {expanded ? (
          <div className="flex flex-col gap-3 border-t border-white/[0.07] pt-3">
            {error ? (
              <div className="rounded-xl border border-red-400/25 bg-red-500/10 px-3 py-2 text-[13px] text-red-200">
                {error}
              </div>
            ) : null}

            {!loading && offers.length === 0 ? (
              <p className="text-[14px] leading-relaxed text-white/68">Noch keine Fahrt angeboten.</p>
            ) : null}

            {offers.map((offer) => {
              const offerReservations = reservations.filter((row) => row.offer_id === offer.id);
              const freeSeats = Math.max(0, offer.seat_count - offerReservations.length);
              const isOwn = offer.driver_user_id === currentUserId;
              const ownReservations = offerReservations.filter((row) => myPlayerIds.includes(row.player_id));
              const hasUnreservedOwnPlayer = myPlayers.some(
                (player) => !reservations.some((row) => row.player_id === player.id),
              );
              return (
                <section key={offer.id} className="rounded-2xl border border-white/[0.09] bg-black/25 p-3.5">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-[17px] font-bold text-white">
                        {isOwn ? 'Meine Fahrt' : `${offer.driver_name} fährt`}
                      </p>
                      <span
                        className={`mt-1.5 inline-flex rounded-full px-2.5 py-1 text-[12px] font-bold uppercase tracking-[0.06em] ${
                          freeSeats > 0
                            ? 'border border-emerald-400/25 bg-emerald-500/14 text-emerald-300'
                            : 'border border-white/10 bg-white/[0.05] text-white/55'
                        }`}
                      >
                        {freeSeats > 0 ? `Noch ${freeSeats} ${freeSeats === 1 ? 'Platz' : 'Plätze'} frei` : 'Voll besetzt'}
                      </span>
                    </div>
                    {(isOwn || canManage) && (
                      <div className="flex shrink-0 gap-1">
                        {isOwn ? (
                          <button type="button" className="rounded-lg p-2 text-white/65 hover:bg-white/[0.07] hover:text-white" onClick={() => openOfferModal(offer)} aria-label="Fahrt bearbeiten">
                            <Pencil className="h-4 w-4" />
                          </button>
                        ) : null}
                        <button type="button" className="rounded-lg p-2 text-red-300/75 hover:bg-red-500/10 hover:text-red-200" onClick={() => void deleteOffer(offer)} aria-label="Fahrt löschen">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    )}
                  </div>

                  <div className="mt-3 grid gap-2.5 text-[15px] font-medium text-white/82">
                    <div className="flex items-center gap-2"><Clock3 className="sz-club-accent-text h-4 w-4" /><span>Abfahrt {timeLabel(offer.departure_at)} Uhr</span></div>
                    <div className="flex items-start gap-2"><MapPin className="sz-club-accent-text mt-0.5 h-4 w-4 shrink-0" /><span className="break-words">{offer.departure_location}</span></div>
                    <div className="flex items-center gap-2"><RotateCcw className="sz-club-accent-text h-4 w-4" /><span>{offer.return_included ? 'Rückfahrt inklusive' : 'Nur Hinfahrt'}</span></div>
                  </div>
                  {offer.note ? <p className="mt-2.5 rounded-xl bg-white/[0.04] px-3 py-2.5 text-[14px] leading-relaxed text-white/70">{offer.note}</p> : null}
                  {offerReservations.length > 0 ? (
                    <div className="mt-3 flex items-start gap-2 border-t border-white/[0.07] pt-3 text-[14px] text-white/72">
                      <Users className="sz-club-accent-text mt-0.5 h-4 w-4 shrink-0" />
                      <span>Mitfahrer: {offerReservations.map((row) => playerName(playerById.get(row.player_id))).join(', ')}</span>
                    </div>
                  ) : null}
                  {ownReservations.map((reservation) => (
                    <button
                      key={reservation.id}
                      type="button"
                      disabled={busy}
                      className={`mt-3 w-full ${dsSecondaryCtaClass()}`}
                      onClick={() => void cancelReservation(reservation)}
                    >
                      Reservierung für {playerName(playerById.get(reservation.player_id))} zurücknehmen
                    </button>
                  ))}
                  {freeSeats > 0 && hasUnreservedOwnPlayer ? (
                    <button type="button" disabled={busy} className={`mt-3 w-full ${dsPrimaryCtaClass()}`} onClick={() => openPlayerAction({ kind: 'reserve', offerId: offer.id })}>
                      <UserPlus className="h-4 w-4" aria-hidden /> Platz reservieren
                    </button>
                  ) : null}
                </section>
              );
            })}

            {requests.length > 0 ? (
              <div className="rounded-xl border border-amber-300/16 bg-amber-400/[0.06] px-3 py-2.5">
                <p className="text-[12px] font-bold uppercase tracking-[0.1em] text-amber-200/80">Platz gesucht</p>
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  {requests.map((request) => {
                    const own = myPlayerIds.includes(request.player_id);
                    return (
                      <span key={request.id} className="inline-flex items-center gap-1 rounded-full border border-white/10 bg-black/20 px-3 py-1.5 text-[14px] font-medium text-white/80">
                        {playerName(playerById.get(request.player_id))}
                        {own ? <button type="button" disabled={busy} className="ml-0.5 text-white/45 hover:text-white" onClick={() => void cancelRequest(request)} aria-label="Platzgesuch zurücknehmen">×</button> : null}
                      </span>
                    );
                  })}
                </div>
              </div>
            ) : null}

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {canOffer && !ownOffer ? (
                <button type="button" className={dsSecondaryCtaClass()} onClick={() => openOfferModal()}>
                  <Car className="h-4 w-4" aria-hidden /> Fahrt anbieten
                </button>
              ) : null}
              {myPlayers.some(
                (player) =>
                  !reservations.some((row) => row.player_id === player.id) &&
                  !requests.some((row) => row.player_id === player.id),
              ) ? (
                <button type="button" className={dsSecondaryCtaClass()} onClick={() => openPlayerAction({ kind: 'request' })}>
                  <Users className="h-4 w-4" aria-hidden /> Ich suche einen Platz
                </button>
              ) : null}
            </div>
          </div>
        ) : null}
      </Card>

      <Modal
        open={offerModalOpen}
        title={editingOffer ? 'Fahrt bearbeiten' : 'Fahrt anbieten'}
        titleClassName="!text-[22px] !font-bold !tracking-[-0.02em]"
        onClose={() => !busy && setOfferModalOpen(false)}
        footer={
          <div className="grid w-full grid-cols-2 gap-2">
            <button type="button" className={`${dsSecondaryCtaClass()} !min-h-[50px] !text-[16px]`} disabled={busy} onClick={() => setOfferModalOpen(false)}>Abbrechen</button>
            <button type="button" className={`${dsPrimaryCtaClass()} !min-h-[50px] !text-[16px]`} disabled={busy} onClick={() => void saveOffer()}>
              {busy ? 'Speichert…' : editingOffer ? 'Speichern' : 'Fahrt anbieten'}
            </button>
          </div>
        }
      >
        <div className="grid gap-4 pb-1">
          <label className="grid gap-2 text-[15px] font-bold text-white/90">
            Abfahrtszeit
            <span className="relative block">
              <Clock3 className="sz-club-accent-text pointer-events-none absolute left-4 top-1/2 z-10 h-5 w-5 -translate-y-1/2" aria-hidden />
              <input
                type="time"
                value={offerTime}
                onChange={(event) => setOfferTime(event.target.value)}
                className="input min-h-[54px] w-full rounded-[16px] border-white/[0.16] bg-white/[0.055] pl-12 pr-4 text-[17px] font-semibold text-white [color-scheme:dark]"
              />
            </span>
          </label>
          <label className="grid gap-2 text-[15px] font-bold text-white/90">
            Abfahrtsort / Treffpunkt
            <span className="relative block">
              <MapPin className="sz-club-accent-text pointer-events-none absolute left-4 top-1/2 z-10 h-5 w-5 -translate-y-1/2" aria-hidden />
              <input
                type="text"
                maxLength={240}
                value={offerLocation}
                onChange={(event) => setOfferLocation(event.target.value)}
                placeholder="z. B. Sportplatz Rohrbach"
                className="input min-h-[54px] w-full rounded-[16px] border-white/[0.16] bg-white/[0.055] pl-12 pr-4 text-[17px] font-medium text-white placeholder:text-white/42"
              />
            </span>
          </label>
          <fieldset className="grid gap-2">
            <legend className="text-[15px] font-bold text-white/90">Freie Plätze</legend>
            <div className="mt-2 flex min-h-[58px] items-center justify-center gap-6 rounded-[16px] border border-white/[0.12] bg-white/[0.035] px-4">
              <button
                type="button"
                className="flex h-11 w-11 touch-manipulation items-center justify-center rounded-full border border-white/[0.14] bg-white/[0.06] text-white/85 active:scale-95 disabled:opacity-35"
                onClick={() => changeOfferSeats(-1)}
                disabled={Number.parseInt(offerSeats, 10) <= 1}
                aria-label="Einen freien Platz weniger"
              >
                <Minus className="h-5 w-5" aria-hidden />
              </button>
              <output className="min-w-[44px] text-center text-[28px] font-bold tabular-nums text-white" aria-label={`${offerSeats} freie Plätze`}>
                {offerSeats}
              </output>
              <button
                type="button"
                className="sz-club-primary flex h-11 w-11 touch-manipulation items-center justify-center rounded-full border text-white active:scale-95 disabled:opacity-35"
                onClick={() => changeOfferSeats(1)}
                disabled={Number.parseInt(offerSeats, 10) >= 12}
                aria-label="Einen freien Platz mehr"
              >
                <Plus className="h-5 w-5" aria-hidden />
              </button>
            </div>
          </fieldset>
          <label className="flex min-h-[58px] cursor-pointer items-center gap-3 rounded-[16px] border border-white/[0.12] bg-white/[0.035] px-4 text-[15px] font-semibold leading-snug text-white/88">
            <input
              type="checkbox"
              className="peer sr-only"
              checked={offerReturn}
              onChange={(event) => setOfferReturn(event.target.checked)}
            />
            <span
              className={`relative h-7 w-12 shrink-0 rounded-full border transition-colors after:absolute after:left-1 after:top-1 after:h-[18px] after:w-[18px] after:rounded-full after:bg-white after:shadow-md after:transition-transform peer-checked:after:translate-x-5 ${
                offerReturn ? 'sz-club-primary' : 'border-white/[0.16] bg-white/[0.08]'
              }`}
              aria-hidden
            />
            Rückfahrt wird ebenfalls angeboten
          </label>
          <label className="grid gap-2 text-[15px] font-bold text-white/90">
            Anmerkung (optional)
            <span className="relative block">
              <MessageCircle className="sz-club-accent-text pointer-events-none absolute left-4 top-4 z-10 h-5 w-5" aria-hidden />
              <textarea
                maxLength={500}
                rows={2}
                value={offerNote}
                onChange={(event) => setOfferNote(event.target.value)}
                placeholder="z. B. Kindersitz bitte selbst mitbringen"
                className="input min-h-[76px] w-full resize-none rounded-[16px] border-white/[0.16] bg-white/[0.055] py-3.5 pl-12 pr-4 text-[16px] font-medium leading-relaxed text-white placeholder:text-white/42"
              />
            </span>
          </label>
          {error ? <p className="text-[13px] text-red-300">{error}</p> : null}
        </div>
      </Modal>

      <Modal
        open={Boolean(playerAction)}
        title={playerAction?.kind === 'reserve' ? 'Platz reservieren' : 'Platz suchen'}
        titleClassName="!text-[22px] !font-bold !tracking-[-0.02em]"
        onClose={() => !busy && setPlayerAction(null)}
        footer={
          <div className="grid w-full grid-cols-2 gap-2">
            <button type="button" className={`${dsSecondaryCtaClass()} !min-h-[50px] !text-[16px]`} disabled={busy} onClick={() => setPlayerAction(null)}>Abbrechen</button>
            <button type="button" className={`${dsPrimaryCtaClass()} !min-h-[50px] !text-[16px]`} disabled={busy || !selectedPlayerId} onClick={() => void confirmPlayerAction()}>{busy ? 'Speichert…' : 'Bestätigen'}</button>
          </div>
        }
      >
        {playerActionCandidates.length > 0 ? (
          <label className="grid gap-2 text-[15px] font-bold text-white/90">
            Für welches Kind?
            <select className="input min-h-[54px] rounded-[16px] border-white/[0.16] bg-white/[0.055] px-4 text-[17px] font-semibold text-white [color-scheme:dark]" value={selectedPlayerId} onChange={(event) => setSelectedPlayerId(event.target.value)}>
              {playerActionCandidates.map((player) => <option key={player.id} value={player.id}>{player.name}</option>)}
            </select>
          </label>
        ) : (
          <p className="text-[14px] text-white/70">Für alle zugeordneten Spieler besteht bereits eine Reservierung oder ein Platzgesuch.</p>
        )}
        {error ? <p className="mt-3 text-[13px] text-red-300">{error}</p> : null}
      </Modal>
    </>
  );
};
