import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { ChevronDown, ChevronLeft, Upload } from 'lucide-react';
import { useSession } from '../auth/useSession';
import { VenuePicker } from '../components/venues/VenuePicker';
import { canPrepareNextSeason } from '../lib/seasonLifecycle';
import {
  championshipCounts,
  displayOpponentLogoUrl,
  fetchOefbScheduleFixtures,
  importOefbChampionshipFixtures,
  listChampionshipFixtures,
  publishAllAgreedChampionshipFixtures,
  publishChampionshipFixture,
  setOpponentLogoForSeason,
  updateChampionshipFixture,
  type ChampionshipFixture,
} from '../lib/championshipFixtures';
import { getOurTeamDisplayName, getOurTeamLogoUrl, PLACEHOLDER_LOGO } from '../lib/teamLogos';
import { fetchSeasonManagementSnapshot } from '../lib/seasonManagementData';
import { supabase } from '../lib/supabaseClient';
import {
  isViennaPlaceholderKickoff,
  meetupUtcIsoOnViennaEventDay,
  parseViennaDateTimeLocalToUtcIso,
  utcIsoToViennaDateInput,
  utcIsoToViennaTimeHHmm,
} from '../lib/viennaTime';
import type { VenueRow } from '../lib/venues';
import { PageShell, PremiumButton, PremiumCard, SectionTitle } from '../ui';
import { cn } from '../ui/lib/cn';
import { dsPanelRowClass } from '../lib/premiumDesignSystem';

const DEFAULT_OEFB_URL =
  'https://vereine.oefb.at/USCRohrbach/Mannschaften/Saison-2026-27/U12-1/Spiele';

const inputClass =
  'min-h-[44px] w-full rounded-xl border border-white/12 bg-white/[0.04] px-3 py-2.5 text-[15px] text-white focus:border-red-500/45 focus:outline-none';
const labelClass = 'mb-1 block text-[11px] font-semibold uppercase tracking-[0.1em] text-white/50';

function canAccess(effectiveRole: string, backendRole: string): boolean {
  if ((backendRole ?? '').trim().toLowerCase() === 'admin') return true;
  if (canPrepareNextSeason(effectiveRole) || canPrepareNextSeason(backendRole)) return true;
  const r = (effectiveRole ?? '').trim().toLowerCase();
  return r === 'trainer' || r === 'co_trainer' || r === 'head_coach';
}

function formatOefbDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('de-AT', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Vienna',
  }).format(d);
}

function formatViennaDateOnly(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('de-AT', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'Europe/Vienna',
  }).format(d);
}

/** ÖFB-Vorgabe: 23:00/00:00 Wien oft date-only Artefakt → Datum + „Uhrzeit noch offen“. */
function formatOefbVorgabe(iso: string | null | undefined): { dateLine: string; timeLine: string } {
  if (!iso) return { dateLine: '—', timeLine: 'Uhrzeit noch offen' };
  if (isViennaPlaceholderKickoff(iso)) {
    return { dateLine: formatViennaDateOnly(iso), timeLine: 'Uhrzeit noch offen' };
  }
  return { dateLine: formatViennaDateOnly(iso), timeLine: utcIsoToViennaTimeHHmm(iso) || '—' };
}

function formatOefbVorgabeInline(iso: string | null | undefined): string {
  const v = formatOefbVorgabe(iso);
  return `${v.dateLine} · ${v.timeLine}`;
}

function statusMeta(status: ChampionshipFixture['fixture_status']): {
  label: string;
  hint: string;
  className: string;
  border: string;
} {
  if (status === 'published') {
    return {
      label: 'Veröffentlicht',
      hint: 'Termin ist für Eltern sichtbar',
      className: 'border-sky-500/40 bg-sky-950/50 text-sky-100',
      border: 'border-sky-800/40',
    };
  }
  if (status === 'agreed') {
    return {
      label: 'Vereinbart',
      hint: 'Termin intern gespeichert – für Eltern noch nicht sichtbar',
      className: 'border-emerald-500/40 bg-emerald-950/50 text-emerald-100',
      border: 'border-emerald-800/40',
    };
  }
  return {
    label: 'Offen',
    hint: 'Termin noch nicht vollständig vereinbart',
    className: 'border-amber-500/40 bg-amber-950/45 text-amber-100',
    border: 'border-amber-800/35',
  };
}

function kickoffFromFixture(f: ChampionshipFixture): string {
  if (!f.starts_at || isViennaPlaceholderKickoff(f.starts_at)) return '';
  return utcIsoToViennaTimeHHmm(f.starts_at);
}

function dateFromFixture(f: ChampionshipFixture): string {
  const iso = f.starts_at || f.source_starts_at;
  return iso ? utcIsoToViennaDateInput(iso) : '';
}

export const ChampionshipManagementPage: React.FC = () => {
  const { effectiveRole, backendRole, selectedTeamSeasonId } = useSession();
  const allowed = canAccess(effectiveRole, backendRole);

  const [teamSeasonId, setTeamSeasonId] = useState<string | null>(null);
  const [seasonLabel, setSeasonLabel] = useState('Meisterschaft');
  const [fixtures, setFixtures] = useState<ChampionshipFixture[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [importUrl, setImportUrl] = useState(DEFAULT_OEFB_URL);
  const [editFixture, setEditFixture] = useState<ChampionshipFixture | null>(null);
  const [editDate, setEditDate] = useState('');
  const [editKickoff, setEditKickoff] = useState('');
  const [editMeetup, setEditMeetup] = useState('');
  const [editVenue, setEditVenue] = useState<VenueRow | null>(null);
  const [editLocationName, setEditLocationName] = useState('');
  const [editLocationAddress, setEditLocationAddress] = useState('');
  const [editLogoUrl, setEditLogoUrl] = useState('');
  const [editLogoOpen, setEditLogoOpen] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [confirmPublishId, setConfirmPublishId] = useState<string | null>(null);
  const [confirmBulkPublish, setConfirmBulkPublish] = useState(false);
  const [publishVenueWarn, setPublishVenueWarn] = useState(false);

  const counts = useMemo(() => championshipCounts(fixtures), [fixtures]);
  const ourTeamName = useMemo(() => getOurTeamDisplayName(), []);

  const reload = useCallback(async (tsId: string) => {
    setLoading(true);
    setError(null);
    const res = await listChampionshipFixtures(tsId);
    setLoading(false);
    if (res.error) {
      setError(res.error);
      setFixtures([]);
      return;
    }
    setFixtures(res.data);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (!selectedTeamSeasonId) {
        setTeamSeasonId(null);
        setLoading(false);
        return;
      }
      const snap = await fetchSeasonManagementSnapshot(selectedTeamSeasonId);
      if (cancelled) return;
      const activeId = snap.active?.id ?? selectedTeamSeasonId;
      setTeamSeasonId(activeId);
      const age = snap.active?.ageGroup ? `${snap.active.ageGroup}` : '';
      const season = snap.active?.seasonName ? `${snap.active.seasonName}` : '';
      setSeasonLabel([age, season].filter(Boolean).join(' · ') || 'Aktive Saison');
      await reload(activeId);
    })();
    return () => {
      cancelled = true;
    };
  }, [selectedTeamSeasonId, reload]);

  if (!allowed) return <Navigate to="/app/mehr" replace />;

  const onImport = async () => {
    if (!teamSeasonId) return;
    setBusy(true);
    setError(null);
    setInfo(null);
    const ourName = getOurTeamDisplayName();
    const fetched = await fetchOefbScheduleFixtures({
      url: importUrl,
      ourTeamHints: [ourName, 'SPG Rohrbach', 'Rohrbach'],
    });
    if (fetched.error) {
      setBusy(false);
      setError(fetched.error);
      return;
    }
    if (fetched.fixtures.length === 0) {
      setBusy(false);
      setError('Keine Ligaspiel gefunden (Testspiele/Cup werden übersprungen).');
      return;
    }
    const { data: auth } = await supabase.auth.getUser();
    const result = await importOefbChampionshipFixtures({
      teamSeasonId,
      fixtures: fetched.fixtures,
      createdBy: auth.user?.id ?? null,
    });
    setBusy(false);
    if (result.error) {
      setError(result.error);
      return;
    }
    setInfo(
      `Import: ${result.inserted} neu, ${result.updated} aktualisiert` +
        (result.skippedProtected
          ? `, ${result.skippedProtected} vereinbarte/veröffentlichte Termine geschützt`
          : '') +
        '.',
    );
    await reload(teamSeasonId);
  };

  const openEdit = (f: ChampionshipFixture) => {
    setEditFixture(f);
    setEditDate(dateFromFixture(f));
    setEditKickoff(kickoffFromFixture(f));
    setEditMeetup(f.meeting_at ? utcIsoToViennaTimeHHmm(f.meeting_at) : '');
    setEditVenue(null);
    setEditLocationName((f.location ?? '').split(',')[0]?.trim() || '');
    setEditLocationAddress('');
    setEditLogoUrl(f.opponent_logo_url ?? '');
    setEditLogoOpen(false);
    setEditError(null);
  };

  const closeEdit = () => {
    setEditFixture(null);
    setEditError(null);
  };

  const saveEdit = async () => {
    if (!editFixture || !teamSeasonId) return;
    const dateYmd = editDate.trim();
    const kickoff = editKickoff.trim();
    if (!dateYmd) {
      setEditError('Bitte ein Datum setzen.');
      return;
    }

    const isPublished = editFixture.fixture_status === 'published';
    if (isPublished && !kickoff) {
      setEditError('Für veröffentlichte Spiele ist eine Beginnzeit nötig.');
      return;
    }

    let startsAt: string | null = null;
    let nextStatus: ChampionshipFixture['fixture_status'] = editFixture.fixture_status;

    if (kickoff) {
      startsAt = parseViennaDateTimeLocalToUtcIso(`${dateYmd}T${kickoff}`);
      if (!startsAt) {
        setEditError('Ungültiges Datum/Beginn.');
        return;
      }
      if (isPublished) {
        nextStatus = 'published';
      } else {
        nextStatus = 'agreed';
      }
    } else {
      // Nur Datum: Tag speichern, Placeholder-Zeit 12:00 (nicht ÖFB 23:00), Status open
      startsAt = parseViennaDateTimeLocalToUtcIso(`${dateYmd}T12:00`);
      if (!startsAt) {
        setEditError('Ungültiges Datum.');
        return;
      }
      nextStatus = 'open';
    }

    const meetupRaw = editMeetup.trim();
    const meetingAt = meetupRaw ? meetupUtcIsoOnViennaEventDay(startsAt, meetupRaw) : null;

    setBusy(true);
    setEditError(null);

    const res = await updateChampionshipFixture(editFixture.id, {
      startsAt,
      meetingAt,
      fixtureStatus: nextStatus,
      ...(editVenue
        ? { venue: editVenue }
        : editLocationName.trim() || editLocationAddress.trim()
          ? {
              locationText: [editLocationName.trim(), editLocationAddress.trim()]
                .filter(Boolean)
                .join(', '),
            }
          : {}),
    });
    if (res.error) {
      setBusy(false);
      setEditError(res.error);
      return;
    }

    const logoTrim = editLogoUrl.trim();
    if (logoTrim !== (editFixture.opponent_logo_url ?? '').trim()) {
      const logoRes = await setOpponentLogoForSeason({
        teamSeasonId,
        opponentName: editFixture.opponent ?? '',
        logoUrl: logoTrim || null,
      });
      if (logoRes.error) {
        setBusy(false);
        setEditError(logoRes.error);
        return;
      }
    }

    setBusy(false);
    setEditFixture(null);
    setInfo(isPublished ? 'Änderungen gespeichert' : 'Vereinbarung gespeichert');
    await reload(teamSeasonId);
  };

  const requestPublishFromEdit = () => {
    if (!editFixture) return;
    if (!editDate.trim() || !editKickoff.trim()) {
      setEditError('Zum Veröffentlichen Datum und Beginn setzen und speichern.');
      return;
    }
    if (!(editFixture.opponent ?? '').trim()) {
      setEditError('Gegner fehlt.');
      return;
    }
    const hasVenue =
      Boolean(editVenue?.id) ||
      Boolean(editFixture.venue_id) ||
      Boolean(editLocationName.trim()) ||
      Boolean((editFixture.location ?? '').trim());
    setPublishVenueWarn(!hasVenue);
    setConfirmPublishId(editFixture.id);
  };

  const onPublishOne = async (id: string) => {
    if (!teamSeasonId) return;
    // Speichern vor Publish, falls Edit-Maske offen und agreed-fähig
    if (editFixture?.id === id && editKickoff.trim() && editDate.trim()) {
      const startsAt = parseViennaDateTimeLocalToUtcIso(`${editDate.trim()}T${editKickoff.trim()}`);
      if (startsAt) {
        const meetupRaw = editMeetup.trim();
        const meetingAt = meetupRaw ? meetupUtcIsoOnViennaEventDay(startsAt, meetupRaw) : null;
        await updateChampionshipFixture(id, {
          startsAt,
          meetingAt,
          fixtureStatus: 'agreed',
          ...(editVenue ? { venue: editVenue } : {}),
        });
      }
    }
    setBusy(true);
    setError(null);
    const res = await publishChampionshipFixture(id);
    setBusy(false);
    setConfirmPublishId(null);
    setPublishVenueWarn(false);
    if (res.error) {
      setError(res.error);
      setEditError(res.error);
      return;
    }
    setInfo('Termin veröffentlicht — jetzt für Spieler und Eltern sichtbar.');
    setEditFixture(null);
    await reload(teamSeasonId);
  };

  const onPublishAllAgreed = async () => {
    if (!teamSeasonId) return;
    setBusy(true);
    setError(null);
    const res = await publishAllAgreedChampionshipFixtures(teamSeasonId);
    setBusy(false);
    setConfirmBulkPublish(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    setInfo(`${res.published} vereinbarte Spiele veröffentlicht. Kein automatischer Feed-Spam.`);
    await reload(teamSeasonId);
  };

  const applyKnownLogo = () => {
    if (!editFixture) return;
    const url = displayOpponentLogoUrl(editFixture.opponent, null);
    if (url && url !== PLACEHOLDER_LOGO) setEditLogoUrl(url);
  };

  const editStatusMeta = editFixture ? statusMeta(editFixture.fixture_status) : null;
  const editOefb = editFixture
    ? formatOefbVorgabe(editFixture.source_starts_at ?? editFixture.starts_at)
    : null;
  const editHeaderTitle = editFixture
    ? editFixture.is_home
      ? ourTeamName || 'Heim'
      : editFixture.opponent || 'Gegner'
    : '';
  const editHeaderLogo = editFixture
    ? editFixture.is_home
      ? getOurTeamLogoUrl()
      : displayOpponentLogoUrl(editFixture.opponent, editLogoUrl || editFixture.opponent_logo_url)
    : PLACEHOLDER_LOGO;
  const saveCtaLabel =
    editFixture?.fixture_status === 'published'
      ? 'Änderungen speichern'
      : 'Vereinbarung speichern';
  const canShowPublishInEdit =
    editFixture &&
    (editFixture.fixture_status === 'agreed' ||
      (editFixture.fixture_status === 'open' && Boolean(editDate.trim() && editKickoff.trim())));

  return (
    <PageShell
      background="more"
      className="min-h-[60vh] w-full px-3 py-6 sm:px-4 md:px-0"
      contentClassName="mx-auto w-full min-w-0 max-w-lg space-y-4"
    >
      <Link
        to="/app/mehr/seasons"
        className={cn(dsPanelRowClass(), '!min-h-[40px] !py-2 text-sm font-semibold text-white/85')}
      >
        <span className="flex items-center gap-2">
          <ChevronLeft className="h-4 w-4 text-white/50" aria-hidden />
          Zurück zur Saisonverwaltung
        </span>
      </Link>

      <SectionTitle subtitle={seasonLabel}>Meisterschaft</SectionTitle>

      <PremiumCard variant="subtle" showAmbientGlow={false} className="space-y-2">
        <p className="text-sm text-white/80">
          <span className="font-semibold text-white">{counts.total}</span> Spiele ·{' '}
          <span className="text-amber-200">{counts.open} offen</span> ·{' '}
          <span className="text-emerald-200">{counts.agreed} vereinbart</span> ·{' '}
          <span className="text-sky-200">{counts.published} veröffentlicht</span>
        </p>
        <label className="block text-xs font-medium text-white/55">ÖFB-Spielplan URL</label>
        <input
          className="w-full rounded-xl border border-white/12 bg-white/[0.04] px-3 py-2.5 text-[14px] text-white"
          value={importUrl}
          onChange={(e) => setImportUrl(e.target.value)}
          disabled={busy}
        />
        <PremiumButton
          type="button"
          variant="primary"
          fullWidth
          disabled={busy || !teamSeasonId}
          className="gap-2"
          onClick={() => void onImport()}
        >
          <Upload className="h-4 w-4" aria-hidden />
          {busy ? 'Importiere…' : 'ÖFB-Spielplan importieren'}
        </PremiumButton>
        {counts.agreed > 0 ? (
          <PremiumButton
            type="button"
            variant="subtle"
            fullWidth
            disabled={busy}
            onClick={() => setConfirmBulkPublish(true)}
          >
            Alle vereinbarten Spiele veröffentlichen ({counts.agreed})
          </PremiumButton>
        ) : null}
        <p className="text-[11px] text-white/45">
          Offen und vereinbart bleiben intern. Erst „veröffentlichen“ macht Termine für Eltern
          sichtbar. Kein automatischer Push/Feed-Spam.
        </p>
      </PremiumCard>

      {error ? (
        <p className="rounded-lg border border-red-500/35 bg-red-950/35 px-3 py-2 text-sm text-red-200" role="alert">
          {error}
        </p>
      ) : null}
      {info ? (
        <p className="rounded-lg border border-emerald-500/35 bg-emerald-950/35 px-3 py-2 text-sm text-emerald-100">
          {info}
        </p>
      ) : null}

      {loading ? <p className="text-sm text-white/55">Lade Spiele…</p> : null}

      <div className="space-y-2">
        {fixtures.map((f) => {
          const meta = statusMeta(f.fixture_status);
          const logo = displayOpponentLogoUrl(f.opponent, f.opponent_logo_url);
          return (
            <PremiumCard
              key={f.id}
              variant="subtle"
              showAmbientGlow={false}
              className={cn('space-y-2', meta.border)}
            >
              <div className="flex items-start gap-3">
                <img
                  src={logo}
                  alt=""
                  className="h-11 w-11 shrink-0 rounded-lg bg-white/5 object-contain"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).src = PLACEHOLDER_LOGO;
                  }}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-[15px] font-bold text-white">{f.opponent || 'Gegner'}</p>
                      <p className="text-[12px] font-semibold uppercase tracking-wide text-white/55">
                        {f.is_home ? 'Heim' : 'Auswärts'}
                      </p>
                    </div>
                    <span
                      className={cn(
                        'shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-black uppercase tracking-wider',
                        meta.className,
                      )}
                    >
                      {meta.label}
                    </span>
                  </div>
                </div>
              </div>
              <p className="text-sm text-white/70">
                <span className="text-white/40">ÖFB: </span>
                {formatOefbVorgabeInline(f.source_starts_at ?? f.starts_at)}
              </p>
              <p className="text-sm text-white/70">
                <span className="text-white/40">Vereinbart: </span>
                {f.fixture_status === 'open' || isViennaPlaceholderKickoff(f.starts_at)
                  ? f.fixture_status === 'open'
                    ? 'noch offen'
                    : `${formatViennaDateOnly(f.starts_at)} · Uhrzeit noch offen`
                  : formatOefbDate(f.starts_at)}
              </p>
              {f.location ? <p className="text-xs text-white/45">{f.location}</p> : null}
              <div className="flex flex-col gap-2">
                <PremiumButton type="button" variant="subtle" fullWidth onClick={() => openEdit(f)}>
                  Bearbeiten
                </PremiumButton>
                {f.fixture_status === 'published' ? (
                  <Link
                    to={`/app/events/${f.id}`}
                    className="inline-flex min-h-[44px] w-full items-center justify-center rounded-xl border border-white/12 bg-white/[0.04] px-3 py-2.5 text-sm font-semibold text-white/90"
                  >
                    Termin öffnen
                  </Link>
                ) : null}
                {f.fixture_status === 'agreed' ? (
                  <PremiumButton
                    type="button"
                    variant="primary"
                    fullWidth
                    disabled={busy}
                    onClick={() => {
                      setPublishVenueWarn(!f.venue_id && !(f.location ?? '').trim());
                      setConfirmPublishId(f.id);
                    }}
                  >
                    Als Termin veröffentlichen
                  </PremiumButton>
                ) : null}
              </div>
            </PremiumCard>
          );
        })}
        {!loading && fixtures.length === 0 ? (
          <p className="text-sm text-white/55">Noch keine Meisterschaftsspiele importiert.</p>
        ) : null}
      </div>

      {editFixture && editOefb && editStatusMeta ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/70 sm:items-center sm:p-4">
          <div className="flex max-h-[96vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-2xl border border-white/12 bg-[#0e1118] shadow-xl sm:rounded-2xl">
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-3 pb-3 pt-4 sm:px-4">
              {/* Match header */}
              <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                <div className="flex items-center gap-3">
                  <img
                    src={editHeaderLogo}
                    alt=""
                    className="h-12 w-12 shrink-0 rounded-full bg-white/5 object-contain ring-1 ring-white/10"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).src = PLACEHOLDER_LOGO;
                    }}
                  />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[17px] font-bold text-white">{editHeaderTitle}</p>
                    <p className="text-[11px] font-black uppercase tracking-[0.14em] text-red-400">
                      {editFixture.is_home ? 'Heim' : 'Auswärts'}
                    </p>
                  </div>
                  <span
                    className={cn(
                      'shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-black uppercase tracking-wider',
                      editStatusMeta.className,
                    )}
                  >
                    {editStatusMeta.label}
                  </span>
                </div>
                <div className="mt-3 border-t border-white/8 pt-2.5">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/40">
                    ÖFB-Vorgabe
                  </p>
                  <p className="text-[14px] font-semibold text-white/85">{editOefb.dateLine}</p>
                  <p className="text-[13px] text-white/55">{editOefb.timeLine}</p>
                  <p className="mt-1.5 text-[12px] text-white/40">{editStatusMeta.hint}</p>
                </div>
              </div>

              {/* Termin + Spielort */}
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                  <p className="text-[11px] font-black uppercase tracking-[0.14em] text-white/55">
                    Termin vereinbaren
                  </p>
                  <label className={cn(labelClass, 'mt-3')} htmlFor="champ-edit-date">
                    Datum
                  </label>
                  <input
                    id="champ-edit-date"
                    type="date"
                    className={inputClass}
                    value={editDate}
                    onChange={(e) => setEditDate(e.target.value)}
                    disabled={busy}
                  />
                  <label className={cn(labelClass, 'mt-3')} htmlFor="champ-edit-kickoff">
                    Beginn
                  </label>
                  <input
                    id="champ-edit-kickoff"
                    type="time"
                    className={inputClass}
                    value={editKickoff}
                    onChange={(e) => setEditKickoff(e.target.value)}
                    disabled={busy}
                    placeholder="--:--"
                  />
                  {!editKickoff ? (
                    <p className="mt-1 text-[12px] text-white/40">Uhrzeit noch offen — bewusst setzen</p>
                  ) : null}
                  <label className={cn(labelClass, 'mt-3')} htmlFor="champ-edit-meetup">
                    Treffpunkt
                  </label>
                  <input
                    id="champ-edit-meetup"
                    type="time"
                    className={inputClass}
                    value={editMeetup}
                    onChange={(e) => setEditMeetup(e.target.value)}
                    disabled={busy}
                  />
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-3">
                  <p className="mb-3 text-[11px] font-black uppercase tracking-[0.14em] text-white/55">
                    Spielort
                  </p>
                  <VenuePicker
                    teamSeasonId={editFixture.team_season_id}
                    venueId={editVenue?.id ?? editFixture.venue_id}
                    onVenueChange={(v) => setEditVenue(v)}
                    locationName={editLocationName}
                    locationAddress={editLocationAddress}
                    onLocationNameChange={setEditLocationName}
                    onLocationAddressChange={setEditLocationAddress}
                    matchContext={{
                      isHome: editFixture.is_home,
                      opponentName: editFixture.opponent ?? '',
                    }}
                    compactEmptyState
                    disabled={busy}
                    labelClass={labelClass}
                    inputClass={inputClass}
                  />
                </div>
              </div>

              {/* Gegner & Logo accordion */}
              <div className="mt-3 rounded-2xl border border-white/10 bg-white/[0.03]">
                <button
                  type="button"
                  className="flex min-h-[44px] w-full items-center justify-between gap-2 px-3 py-2 text-left"
                  onClick={() => setEditLogoOpen((v) => !v)}
                  aria-expanded={editLogoOpen}
                >
                  <span className="text-[11px] font-black uppercase tracking-[0.14em] text-white/55">
                    Gegner &amp; Logo
                  </span>
                  <ChevronDown
                    className={cn(
                      'h-4 w-4 text-white/45 transition-transform',
                      editLogoOpen && 'rotate-180',
                    )}
                    aria-hidden
                  />
                </button>
                {editLogoOpen ? (
                  <div className="space-y-2 border-t border-white/8 px-3 pb-3 pt-2">
                    <p className="text-[14px] font-semibold text-white/85">
                      {editFixture.opponent || '—'}
                    </p>
                    <div className="flex items-center gap-3">
                      <img
                        src={displayOpponentLogoUrl(
                          editFixture.opponent,
                          editLogoUrl || editFixture.opponent_logo_url,
                        )}
                        alt=""
                        className="h-14 w-14 rounded-xl bg-white/5 object-contain"
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).src = PLACEHOLDER_LOGO;
                        }}
                      />
                      <div className="min-w-0 flex-1 space-y-2">
                        <button
                          type="button"
                          className="inline-flex min-h-[40px] items-center text-[13px] font-semibold text-sky-200 underline-offset-2 hover:underline"
                          onClick={applyKnownLogo}
                          disabled={busy}
                        >
                          Bekanntes Logo übernehmen
                        </button>
                        <input
                          className={cn(inputClass, 'text-[13px]')}
                          placeholder="Logo-URL eintragen/ändern"
                          value={editLogoUrl}
                          onChange={(e) => setEditLogoUrl(e.target.value)}
                          disabled={busy}
                        />
                      </div>
                    </div>
                  </div>
                ) : null}
              </div>

              {canShowPublishInEdit && editFixture.fixture_status !== 'published' ? (
                <div className="mt-3 rounded-2xl border border-red-500/35 bg-red-950/30 p-3">
                  <p className="text-[12px] text-white/65">
                    Speichern veröffentlicht nicht. Zum Sichtbarmachen für Eltern:
                  </p>
                  <PremiumButton
                    type="button"
                    variant="primary"
                    fullWidth
                    className="mt-2"
                    disabled={busy}
                    onClick={requestPublishFromEdit}
                  >
                    Als Termin veröffentlichen
                  </PremiumButton>
                </div>
              ) : null}

              {editError ? (
                <p className="mt-3 text-sm text-red-300" role="alert">
                  {editError}
                </p>
              ) : null}
            </div>

            {/* Sticky action footer */}
            <div className="shrink-0 border-t border-white/10 bg-[#0e1118]/pb-[max(0.75rem,env(safe-area-inset-bottom))] px-3 pt-3 sm:px-4">
              <div className="flex gap-2">
                <PremiumButton
                  type="button"
                  variant="subtle"
                  className="min-h-[48px] flex-1"
                  disabled={busy}
                  onClick={closeEdit}
                >
                  Abbrechen
                </PremiumButton>
                <PremiumButton
                  type="button"
                  variant="primary"
                  className="min-h-[48px] flex-[1.4]"
                  disabled={busy}
                  onClick={() => void saveEdit()}
                >
                  {saveCtaLabel}
                </PremiumButton>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {confirmPublishId ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-sm space-y-3 rounded-2xl border border-white/12 bg-[#12151c] p-4">
            <p className="text-sm font-semibold text-white">Spiel wirklich veröffentlichen?</p>
            <p className="text-sm text-white/75">
              Der Termin wird anschließend für Spieler und Eltern in Home, Termine und Kalender
              sichtbar.
            </p>
            {publishVenueWarn ? (
              <p className="rounded-lg border border-amber-500/35 bg-amber-950/40 px-3 py-2 text-[13px] text-amber-100">
                Noch kein Spielort hinterlegt. Du kannst bewusst fortfahren.
              </p>
            ) : null}
            <div className="flex gap-2">
              <PremiumButton
                type="button"
                variant="subtle"
                className="flex-1"
                onClick={() => {
                  setConfirmPublishId(null);
                  setPublishVenueWarn(false);
                }}
              >
                Abbrechen
              </PremiumButton>
              <PremiumButton
                type="button"
                variant="primary"
                className="flex-1"
                disabled={busy}
                onClick={() => void onPublishOne(confirmPublishId)}
              >
                Veröffentlichen
              </PremiumButton>
            </div>
          </div>
        </div>
      ) : null}

      {confirmBulkPublish ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-sm space-y-3 rounded-2xl border border-white/12 bg-[#12151c] p-4">
            <p className="text-sm text-white/85">
              {counts.agreed} vereinbarte Spiele werden für Spieler und Eltern sichtbar.
            </p>
            <div className="flex gap-2">
              <PremiumButton
                type="button"
                variant="subtle"
                className="flex-1"
                onClick={() => setConfirmBulkPublish(false)}
              >
                Abbrechen
              </PremiumButton>
              <PremiumButton
                type="button"
                variant="primary"
                className="flex-1"
                disabled={busy}
                onClick={() => void onPublishAllAgreed()}
              >
                Veröffentlichen
              </PremiumButton>
            </div>
          </div>
        </div>
      ) : null}
    </PageShell>
  );
};
