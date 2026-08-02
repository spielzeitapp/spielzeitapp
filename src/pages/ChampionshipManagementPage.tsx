import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { ChevronLeft, Upload } from 'lucide-react';
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
import { getOurTeamDisplayName, PLACEHOLDER_LOGO } from '../lib/teamLogos';
import { fetchSeasonManagementSnapshot } from '../lib/seasonManagementData';
import { supabase } from '../lib/supabaseClient';
import {
  meetupUtcIsoOnViennaEventDay,
  parseViennaDateTimeLocalToUtcIso,
  utcIsoToViennaDateTimeLocal,
  utcIsoToViennaTimeHHmm,
} from '../lib/viennaTime';
import type { VenueRow } from '../lib/venues';
import { PageShell, PremiumButton, PremiumCard, SectionTitle } from '../ui';
import { cn } from '../ui/lib/cn';
import { dsPanelRowClass } from '../lib/premiumDesignSystem';

const DEFAULT_OEFB_URL =
  'https://vereine.oefb.at/USCRohrbach/Mannschaften/Saison-2026-27/U12-1/Spiele';

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

function statusMeta(status: ChampionshipFixture['fixture_status']): {
  label: string;
  className: string;
  border: string;
} {
  if (status === 'published') {
    return {
      label: 'Veröffentlicht',
      className: 'border-sky-500/40 bg-sky-950/50 text-sky-100',
      border: 'border-sky-800/40',
    };
  }
  if (status === 'agreed') {
    return {
      label: 'Termin vereinbart',
      className: 'border-emerald-500/40 bg-emerald-950/50 text-emerald-100',
      border: 'border-emerald-800/40',
    };
  }
  return {
    label: 'Termin offen',
    className: 'border-amber-500/40 bg-amber-950/45 text-amber-100',
    border: 'border-amber-800/35',
  };
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
  const [editStartsLocal, setEditStartsLocal] = useState('');
  const [editMeetup, setEditMeetup] = useState('');
  const [editAgreed, setEditAgreed] = useState(false);
  const [editVenue, setEditVenue] = useState<VenueRow | null>(null);
  const [editLocationName, setEditLocationName] = useState('');
  const [editLocationAddress, setEditLocationAddress] = useState('');
  const [editLogoUrl, setEditLogoUrl] = useState('');
  const [editError, setEditError] = useState<string | null>(null);
  const [confirmPublishId, setConfirmPublishId] = useState<string | null>(null);
  const [confirmBulkPublish, setConfirmBulkPublish] = useState(false);

  const counts = useMemo(() => championshipCounts(fixtures), [fixtures]);

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
    setEditStartsLocal(utcIsoToViennaDateTimeLocal(f.starts_at));
    setEditMeetup(utcIsoToViennaTimeHHmm(f.meeting_at ?? ''));
    setEditAgreed(f.fixture_status === 'agreed' || f.fixture_status === 'published');
    setEditVenue(null);
    setEditLocationName((f.location ?? '').split(',')[0]?.trim() || '');
    setEditLocationAddress('');
    setEditLogoUrl(f.opponent_logo_url ?? '');
    setEditError(null);
  };

  const saveEdit = async () => {
    if (!editFixture || !teamSeasonId) return;
    if (editFixture.fixture_status === 'published') {
      setEditError('Veröffentlichte Spiele hier nicht zurücksetzen — Termin in Termine öffnen.');
      return;
    }
    const startsAt = parseViennaDateTimeLocalToUtcIso(editStartsLocal.trim());
    if (!startsAt) {
      setEditError('Ungültiges Datum/Uhrzeit.');
      return;
    }
    const meetupRaw = editMeetup.trim();
    const meetingAt = meetupRaw ? meetupUtcIsoOnViennaEventDay(startsAt, meetupRaw) : null;
    setBusy(true);
    setEditError(null);

    const nextStatus = editAgreed ? 'agreed' : 'open';
    const res = await updateChampionshipFixture(editFixture.id, {
      startsAt,
      meetingAt,
      fixtureStatus: nextStatus,
      ...(editVenue ? { venue: editVenue } : {}),
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
    await reload(teamSeasonId);
  };

  const onPublishOne = async (id: string) => {
    if (!teamSeasonId) return;
    setBusy(true);
    setError(null);
    const res = await publishChampionshipFixture(id);
    setBusy(false);
    setConfirmPublishId(null);
    if (res.error) {
      setError(res.error);
      return;
    }
    setInfo('Termin veröffentlicht — jetzt für Spieler und Eltern sichtbar.');
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
          open/agreed bleiben intern. Erst „veröffentlichen“ macht Termine für Eltern sichtbar. Kein
          automatischer Push/Feed-Spam.
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
                {formatOefbDate(f.source_starts_at ?? f.starts_at)}
              </p>
              <p className="text-sm text-white/70">
                <span className="text-white/40">Vereinbart: </span>
                {f.fixture_status === 'open' ? 'noch offen' : formatOefbDate(f.starts_at)}
              </p>
              {f.location ? <p className="text-xs text-white/45">{f.location}</p> : null}
              <div className="flex flex-col gap-2">
                {f.fixture_status !== 'published' ? (
                  <PremiumButton type="button" variant="subtle" fullWidth onClick={() => openEdit(f)}>
                    Bearbeiten
                  </PremiumButton>
                ) : (
                  <Link
                    to={`/app/events/${f.id}`}
                    className="inline-flex w-full items-center justify-center rounded-xl border border-white/12 bg-white/[0.04] px-3 py-2.5 text-sm font-semibold text-white/90"
                  >
                    Termin öffnen
                  </Link>
                )}
                {f.fixture_status === 'agreed' ? (
                  <PremiumButton
                    type="button"
                    variant="primary"
                    fullWidth
                    disabled={busy}
                    onClick={() => setConfirmPublishId(f.id)}
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

      {editFixture ? (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/65 p-3 sm:items-center">
          <div className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-2xl border border-white/12 bg-[#12151c] p-4 shadow-xl">
            <h3 className="text-lg font-bold text-white">Spiel bearbeiten</h3>
            <div className="mt-2 flex items-center gap-3">
              <img
                src={displayOpponentLogoUrl(editFixture.opponent, editLogoUrl || editFixture.opponent_logo_url)}
                alt=""
                className="h-12 w-12 rounded-lg bg-white/5 object-contain"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).src = PLACEHOLDER_LOGO;
                }}
              />
              <div>
                <p className="text-sm text-white/70">{editFixture.opponent}</p>
                <p className="text-xs uppercase tracking-wide text-white/45">
                  {editFixture.is_home ? 'Heim' : 'Auswärts'}
                </p>
              </div>
            </div>
            <p className="mt-3 text-xs text-white/50">
              ÖFB-Vorgabe: {formatOefbDate(editFixture.source_starts_at ?? editFixture.starts_at)}
            </p>

            <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.12em] text-white/55">
              Vereinbarter Termin
            </p>
            <label className="mt-2 block text-xs text-white/55">Datum / Beginn</label>
            <input
              type="datetime-local"
              className="mt-1 w-full rounded-xl border border-white/12 bg-white/[0.04] px-3 py-2.5 text-white"
              value={editStartsLocal}
              onChange={(e) => setEditStartsLocal(e.target.value)}
              disabled={busy}
            />
            <label className="mt-3 block text-xs text-white/55">Treffpunkt</label>
            <input
              type="time"
              className="mt-1 w-full rounded-xl border border-white/12 bg-white/[0.04] px-3 py-2.5 text-white"
              value={editMeetup}
              onChange={(e) => setEditMeetup(e.target.value)}
              disabled={busy}
            />

            <div className="mt-4">
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
                disabled={busy}
              />
            </div>

            <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.12em] text-white/55">
              Gegnerlogo
            </p>
            <input
              className="mt-1 w-full rounded-xl border border-white/12 bg-white/[0.04] px-3 py-2.5 text-[13px] text-white"
              placeholder="/logos/… oder https://…"
              value={editLogoUrl}
              onChange={(e) => setEditLogoUrl(e.target.value)}
              disabled={busy}
            />
            <button
              type="button"
              className="mt-2 text-xs font-semibold text-sky-200 underline"
              onClick={applyKnownLogo}
            >
              Bekanntes lokales Logo übernehmen
            </button>

            <label className="mt-4 flex items-center gap-2 text-sm text-white/80">
              <input
                type="checkbox"
                checked={editAgreed}
                onChange={(e) => setEditAgreed(e.target.checked)}
                disabled={busy}
              />
              Termin mit Gegner vereinbart
            </label>
            <p className="mt-1 text-[11px] text-white/40">
              Speichern setzt nur open/agreed — noch nicht für Eltern sichtbar.
            </p>

            {editError ? <p className="mt-2 text-sm text-red-300">{editError}</p> : null}

            <div className="mt-4 flex gap-2">
              <PremiumButton
                type="button"
                variant="subtle"
                className="flex-1"
                disabled={busy}
                onClick={() => setEditFixture(null)}
              >
                Abbrechen
              </PremiumButton>
              <PremiumButton
                type="button"
                variant="primary"
                className="flex-1"
                disabled={busy}
                onClick={() => void saveEdit()}
              >
                Änderungen speichern
              </PremiumButton>
            </div>
          </div>
        </div>
      ) : null}

      {confirmPublishId ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-sm space-y-3 rounded-2xl border border-white/12 bg-[#12151c] p-4">
            <p className="text-sm text-white/85">
              Dieser Termin wird jetzt für Spieler und Eltern sichtbar.
            </p>
            <div className="flex gap-2">
              <PremiumButton
                type="button"
                variant="subtle"
                className="flex-1"
                onClick={() => setConfirmPublishId(null)}
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
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
