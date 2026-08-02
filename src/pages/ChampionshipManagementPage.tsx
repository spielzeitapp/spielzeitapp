import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { ChevronLeft, Upload } from 'lucide-react';
import { useSession } from '../auth/useSession';
import { VenuePicker } from '../components/venues/VenuePicker';
import { canPrepareNextSeason } from '../lib/seasonLifecycle';
import {
  championshipCounts,
  fetchOefbScheduleFixtures,
  importOefbChampionshipFixtures,
  listChampionshipFixtures,
  updateChampionshipFixture,
  type ChampionshipFixture,
} from '../lib/championshipFixtures';
import { getOurTeamDisplayName } from '../lib/teamLogos';
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
  const [editError, setEditError] = useState<string | null>(null);

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
        (result.skippedAgreed ? `, ${result.skippedAgreed} vereinbarte Termine geschützt` : '') +
        '.',
    );
    await reload(teamSeasonId);
  };

  const openEdit = (f: ChampionshipFixture) => {
    setEditFixture(f);
    setEditStartsLocal(utcIsoToViennaDateTimeLocal(f.starts_at));
    setEditMeetup(utcIsoToViennaTimeHHmm(f.meeting_at ?? ''));
    setEditAgreed(f.fixture_status === 'agreed');
    setEditVenue(null);
    setEditLocationName((f.location ?? '').split(',')[0]?.trim() || '');
    setEditLocationAddress('');
    setEditError(null);
  };

  const saveEdit = async () => {
    if (!editFixture) return;
    const startsAt = parseViennaDateTimeLocalToUtcIso(editStartsLocal.trim());
    if (!startsAt) {
      setEditError('Ungültiges Datum/Uhrzeit.');
      return;
    }
    const meetupRaw = editMeetup.trim();
    const meetingAt = meetupRaw ? meetupUtcIsoOnViennaEventDay(startsAt, meetupRaw) : null;
    setBusy(true);
    setEditError(null);
    const res = await updateChampionshipFixture(editFixture.id, {
      startsAt,
      meetingAt,
      fixtureStatus: editAgreed ? 'agreed' : 'open',
      ...(editVenue
        ? { venue: editVenue }
        : {}),
    });
    setBusy(false);
    if (res.error) {
      setEditError(res.error);
      return;
    }
    setEditFixture(null);
    if (teamSeasonId) await reload(teamSeasonId);
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
          <span className="text-emerald-200">{counts.agreed} fertig vereinbart</span> ·{' '}
          <span className="text-amber-200">{counts.open} noch zu bearbeiten</span>
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
        <p className="text-[11px] text-white/45">
          Nur Ligaspiel. Testspiele/Cup werden übersprungen. Bereits vereinbarte Termine bleiben geschützt.
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
          const agreed = f.fixture_status === 'agreed';
          return (
            <PremiumCard
              key={f.id}
              variant="subtle"
              showAmbientGlow={false}
              className={cn('space-y-2', agreed ? 'border-emerald-800/40' : 'border-amber-800/35')}
            >
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
                    agreed
                      ? 'border-emerald-500/40 bg-emerald-950/50 text-emerald-100'
                      : 'border-amber-500/40 bg-amber-950/45 text-amber-100',
                  )}
                >
                  {agreed ? 'Termin vereinbart' : 'Termin noch offen'}
                </span>
              </div>
              <p className="text-sm text-white/70">
                {formatOefbDate(f.starts_at)}
                {f.source_starts_at ? (
                  <span className="text-white/40"> · ÖFB-Vorgabe {formatOefbDate(f.source_starts_at)}</span>
                ) : (
                  <span className="text-white/40"> · ÖFB-Vorgabe</span>
                )}
              </p>
              {f.location ? <p className="text-xs text-white/45">{f.location}</p> : null}
              <PremiumButton type="button" variant="subtle" fullWidth onClick={() => openEdit(f)}>
                Bearbeiten
              </PremiumButton>
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
            <p className="mt-1 text-sm text-white/70">{editFixture.opponent}</p>
            <p className="text-xs uppercase tracking-wide text-white/45">
              {editFixture.is_home ? 'Heim' : 'Auswärts'}
            </p>
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

            <label className="mt-4 flex items-center gap-2 text-sm text-white/80">
              <input
                type="checkbox"
                checked={editAgreed}
                onChange={(e) => setEditAgreed(e.target.checked)}
                disabled={busy}
              />
              Termin mit Gegner vereinbart
            </label>

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
                Speichern
              </PremiumButton>
            </div>
          </div>
        </div>
      ) : null}
    </PageShell>
  );
};
