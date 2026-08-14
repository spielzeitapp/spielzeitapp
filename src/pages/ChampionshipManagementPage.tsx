import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { ChevronDown, ChevronLeft, FileText, Upload } from 'lucide-react';
import { useSession } from '../auth/useSession';
import { VenuePicker } from '../components/venues/VenuePicker';
import {
  EventDateField,
  EventTimeField,
  EVENT_FORM_INPUT_CLASS,
  EVENT_FORM_LABEL_CLASS,
} from '../components/events';
import { canPrepareNextSeason } from '../lib/seasonLifecycle';
import {
  championshipCounts,
  displayOpponentLogoUrl,
  fetchChampionshipPdfSeasonMeta,
  fetchOefbScheduleFixtures,
  importOefbChampionshipFixtures,
  listChampionshipFixtures,
  publishAllAgreedChampionshipFixtures,
  publishChampionshipFixture,
  setOpponentLogoForSeason,
  updateChampionshipFixture,
  type ChampionshipFixture,
} from '../lib/championshipFixtures';
import {
  fetchOpponentCatalogLogoMap,
  resolveClubIdFromTeamSeason,
  resolveDisplayOpponentLogo,
  uploadOpponentLogoFile,
} from '../lib/opponentCatalog';
import { downloadChampionshipSchedulePdf, type ChampionshipPdfMode } from '../lib/championshipPdf';
import {
  maybePublishChampionshipMatchChangedFeed,
  maybePublishChampionshipScheduleFeed,
  type ChampionshipMaterialSnapshot,
} from '../lib/championshipScheduleFeed';
import { loadSeasonPlanRows } from '../lib/seasonPlanData';
import { downloadSeasonPlanPdf } from '../lib/seasonPlanPdf';
import { normalizeOpponentKey } from '../lib/teamVenues';
import { formatVisibleMatchEncounter } from '../lib/oefbTeamNameNormalize';
import { getOurTeamDisplayName, getOurTeamLogoUrl, PLACEHOLDER_LOGO } from '../lib/teamLogos';
import { fetchSeasonManagementSnapshot } from '../lib/seasonManagementData';
import { supabase } from '../lib/supabaseClient';
import {
  isChampionshipKickoffTimeOpen,
  isViennaPlaceholderKickoff,
  meetupUtcIsoOnViennaEventDay,
  parseViennaDateTimeLocalToUtcIso,
  utcIsoToViennaDateInput,
  utcIsoToViennaTimeHHmm,
  viennaOpenKickoffUtcIsoFromDateYmd,
} from '../lib/viennaTime';
import type { VenueRow } from '../lib/venues';
import { locationTextFromVenue } from '../lib/venues';
import { Button } from '../app/components/ui/Button';
import { Modal } from '../app/ui/Modal';
import { PageShell, PremiumButton, PremiumCard, SectionTitle } from '../ui';
import { cn } from '../ui/lib/cn';
import { dsPanelRowClass } from '../lib/premiumDesignSystem';

const DEFAULT_OEFB_URL =
  'https://vereine.oefb.at/USCRohrbach/Mannschaften/Saison-2026-27/U12-1/Spiele';

const inputClass = EVENT_FORM_INPUT_CLASS;
const labelClass = EVENT_FORM_LABEL_CLASS;
const sectionLabelClass =
  'mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-white/55';

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
  if (!f.starts_at || isChampionshipKickoffTimeOpen(f.starts_at, f.fixture_status)) return '';
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
  const [ageGroupLabel, setAgeGroupLabel] = useState('');
  const [seasonNameLabel, setSeasonNameLabel] = useState('');
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
  const [filter, setFilter] = useState<'all' | 'open' | 'agreed' | 'published'>('all');
  const [clubId, setClubId] = useState<string | null>(null);
  const [catalogLogoMap, setCatalogLogoMap] = useState<Map<string, string>>(new Map());
  const [pdfOpen, setPdfOpen] = useState(false);
  const [pdfMode, setPdfMode] = useState<ChampionshipPdfMode>('published');
  const [pdfBusy, setPdfBusy] = useState(false);
  const [pdfError, setPdfError] = useState<string | null>(null);
  const [seasonPlanOpen, setSeasonPlanOpen] = useState(false);
  const [seasonPlanBusy, setSeasonPlanBusy] = useState(false);
  const [seasonPlanError, setSeasonPlanError] = useState<string | null>(null);
  const [importOpen, setImportOpen] = useState(false);
  const logoFileInputRef = useRef<HTMLInputElement | null>(null);

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
    const resolvedClubId = await resolveClubIdFromTeamSeason(tsId);
    setClubId(resolvedClubId);
    if (resolvedClubId) {
      const map = await fetchOpponentCatalogLogoMap(
        resolvedClubId,
        res.data.map((f) => f.opponent ?? ''),
      );
      setCatalogLogoMap(map);
    } else {
      setCatalogLogoMap(new Map());
    }
  }, []);

  const logoFor = useCallback(
    (f: ChampionshipFixture): string =>
      resolveDisplayOpponentLogo({
        opponent: f.opponent,
        eventLogoUrl: f.opponent_logo_url,
        catalogLogoUrl: catalogLogoMap.get(normalizeOpponentKey(f.opponent)),
      }),
    [catalogLogoMap],
  );

  const filteredFixtures = useMemo(() => {
    if (filter === 'all') return fixtures;
    return fixtures.filter((f) => f.fixture_status === filter);
  }, [fixtures, filter]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (!selectedTeamSeasonId) {
        setTeamSeasonId(null);
        setLoading(false);
        return;
      }
      const { data: snap, error: snapError } = await fetchSeasonManagementSnapshot(
        selectedTeamSeasonId,
      );
      if (cancelled) return;
      if (snapError) {
        setError(snapError);
        setLoading(false);
        return;
      }
      const selectedCard =
        snap?.active?.id === selectedTeamSeasonId
          ? snap.active
          : snap?.draft?.id === selectedTeamSeasonId
            ? snap.draft
            : snap?.active ?? snap?.draft ?? null;
      const activeId = selectedCard?.id ?? snap?.active?.id ?? selectedTeamSeasonId;
      setTeamSeasonId(activeId);
      const age =
        (selectedCard?.ageGroup ? `${selectedCard.ageGroup}`.trim() : '') ||
        (String(selectedCard?.displayName ?? '').match(/\bU\s?\d{1,2}\b/i)?.[0] ?? '')
          .replace(/\s+/g, '')
          .toUpperCase();
      const season = selectedCard?.seasonName ? `${selectedCard.seasonName}` : '';
      setAgeGroupLabel(age);
      setSeasonNameLabel(season);
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
      // Nur Datum: Tag + bestehender Open-Kickoff-Sentinel (Vienna 23:00), Status open.
      // Nie 12:00 — echte Mittagsspiele müssen unterscheidbar bleiben.
      startsAt = viennaOpenKickoffUtcIsoFromDateYmd(dateYmd);
      if (!startsAt) {
        setEditError('Ungültiges Datum.');
        return;
      }
      nextStatus = 'open';
    }

    const meetupRaw = editMeetup.trim();
    const meetingAt = meetupRaw ? meetupUtcIsoOnViennaEventDay(startsAt, meetupRaw) : null;

    const beforeSnap: ChampionshipMaterialSnapshot = {
      starts_at: editFixture.starts_at,
      meeting_at: editFixture.meeting_at,
      venue_id: editFixture.venue_id,
      location: editFixture.location,
      opponent: editFixture.opponent,
      is_home: editFixture.is_home,
    };
    const afterSnap: ChampionshipMaterialSnapshot = {
      starts_at: startsAt,
      meeting_at: meetingAt,
      venue_id: editVenue
        ? editVenue.id
        : editLocationName.trim() || editLocationAddress.trim()
          ? null
          : editFixture.venue_id,
      location: editVenue
        ? locationTextFromVenue(editVenue)
        : editLocationName.trim() || editLocationAddress.trim()
          ? [editLocationName.trim(), editLocationAddress.trim()].filter(Boolean).join(', ')
          : editFixture.location,
      opponent: editFixture.opponent,
      is_home: editFixture.is_home,
    };

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

    if (isPublished) {
      await maybePublishChampionshipMatchChangedFeed({
        teamSeasonId,
        eventId: editFixture.id,
        before: beforeSnap,
        after: afterSnap,
        ourTeamName,
      });
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
    if (!res.error) {
      await maybePublishChampionshipScheduleFeed({
        teamSeasonId,
        ageGroup: ageGroupLabel || null,
        seasonName: seasonNameLabel || null,
      });
    }
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
    let feedNote = '';
    if (!res.error && res.published > 0) {
      const feed = await maybePublishChampionshipScheduleFeed({
        teamSeasonId,
        ageGroup: ageGroupLabel || null,
        seasonName: seasonNameLabel || null,
      });
      if (feed.posted) feedNote = ' Ein Feed-Hinweis wurde erstellt.';
    }
    setBusy(false);
    setConfirmBulkPublish(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    setInfo(`${res.published} vereinbarte Spiele veröffentlicht.${feedNote}`);
    await reload(teamSeasonId);
  };

  const applyKnownLogo = () => {
    if (!editFixture) return;
    const url = displayOpponentLogoUrl(editFixture.opponent, null);
    if (url && url !== PLACEHOLDER_LOGO) setEditLogoUrl(url);
  };

  const onLogoFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    e.target.value = '';
    if (!file || !editFixture || !clubId) return;
    setBusy(true);
    setEditError(null);
    const up = await uploadOpponentLogoFile({
      clubId,
      opponentName: editFixture.opponent ?? '',
      file,
    });
    setBusy(false);
    if (up.error) {
      setEditError(up.error);
      return;
    }
    if (up.publicUrl) {
      setEditLogoUrl(up.publicUrl);
      if (teamSeasonId) {
        await setOpponentLogoForSeason({
          teamSeasonId,
          opponentName: editFixture.opponent ?? '',
          logoUrl: up.publicUrl,
        });
      }
    }
  };

  const onDownloadPdf = () => {
    void (async () => {
      if (!teamSeasonId) {
        setPdfError('PDF konnte nicht erstellt werden.');
        setError('Keine aktive Saison für den PDF-Export.');
        return;
      }
      setPdfBusy(true);
      setBusy(true);
      setPdfError(null);
      setError(null);
      try {
        // Immer frisch aus der DB — kein gecachtes/statisches PDF
        const listed = await listChampionshipFixtures(teamSeasonId);
        if (listed.error) {
          console.error('[championshipPdf] fixtures reload failed', listed.error);
          setPdfError('PDF konnte nicht erstellt werden.');
          setError(listed.error);
          return;
        }
        const fresh = listed.data ?? [];
        // Meta frisch aus der team_season laden (nicht nur State — Fix leerer Header)
        const meta = await fetchChampionshipPdfSeasonMeta(teamSeasonId);
        const ageGroup = meta.ageGroup || ageGroupLabel || null;
        const seasonName = meta.seasonName || seasonNameLabel || null;
        const seasonPhase = meta.seasonPhase;
        if (meta.ageGroup) setAgeGroupLabel(meta.ageGroup);
        if (meta.seasonName) setSeasonNameLabel(meta.seasonName);
        if (import.meta.env.DEV) {
          console.debug('[ChampionshipPDF]', {
            generator: 'downloadChampionshipSchedulePdf@championshipPdf.ts',
            ageGroup,
            seasonName,
            seasonPhase,
            teamName: ourTeamName,
          });
        }
        let logoMap = catalogLogoMap;
        if (clubId) {
          try {
            logoMap = await fetchOpponentCatalogLogoMap(
              clubId,
              fresh.map((f) => f.opponent ?? ''),
            );
            setCatalogLogoMap(logoMap);
          } catch (logoErr) {
            console.error('[championshipPdf] catalog logos failed', logoErr);
            // Logos optional — mit bestehender Map / Placeholder weiter
          }
        }
        const opponentLogoUrls: Record<string, string> = {};
        for (const f of fresh) {
          const name = (f.opponent || '').trim();
          if (!name || opponentLogoUrls[name]) continue;
          opponentLogoUrls[name] = resolveDisplayOpponentLogo({
            opponent: f.opponent,
            eventLogoUrl: f.opponent_logo_url,
            catalogLogoUrl: logoMap.get(normalizeOpponentKey(f.opponent)),
          });
        }
        const res = await downloadChampionshipSchedulePdf({
          fixtures: fresh,
          mode: pdfMode,
          teamName: ourTeamName || 'Mannschaft',
          ageGroup,
          seasonName,
          seasonPhase,
          teamLogoUrl: getOurTeamLogoUrl(),
          opponentLogoUrls,
        });
        if (res.error) {
          console.error('[championshipPdf] export failed', res.error);
          setPdfError('PDF konnte nicht erstellt werden.');
          setError(res.error);
          return;
        }
        setFixtures(fresh);
        setPdfOpen(false);
      } catch (err) {
        console.error('[championshipPdf] unexpected export error', err);
        setPdfError('PDF konnte nicht erstellt werden.');
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setPdfBusy(false);
        setBusy(false);
      }
    })();
  };

  const onDownloadSeasonPlanPdf = () => {
    void (async () => {
      if (!teamSeasonId) {
        setSeasonPlanError('PDF konnte nicht erstellt werden.');
        setError('Keine aktive Saison für den PDF-Export.');
        return;
      }
      setSeasonPlanBusy(true);
      setBusy(true);
      setSeasonPlanError(null);
      setError(null);
      try {
        const meta = await fetchChampionshipPdfSeasonMeta(teamSeasonId);
        const ageGroup = meta.ageGroup || ageGroupLabel || null;
        const seasonName = meta.seasonName || seasonNameLabel || null;
        const seasonPhase = meta.seasonPhase;
        if (meta.ageGroup) setAgeGroupLabel(meta.ageGroup);
        if (meta.seasonName) setSeasonNameLabel(meta.seasonName);

        const loaded = await loadSeasonPlanRows({
          teamSeasonId,
          ourTeamName: ourTeamName || 'Mannschaft',
          includeTrainings: false,
        });
        if (loaded.error) {
          console.error('[seasonPlanPdf] load failed', loaded.error);
          setSeasonPlanError('PDF konnte nicht erstellt werden.');
          setError(loaded.error);
          return;
        }

        let logoMap = catalogLogoMap;
        const resolvedClubId = clubId || (await resolveClubIdFromTeamSeason(teamSeasonId));
        if (resolvedClubId) {
          try {
            logoMap = await fetchOpponentCatalogLogoMap(
              resolvedClubId,
              loaded.rows.map((r) => r.opponent ?? ''),
            );
            setCatalogLogoMap(logoMap);
            if (!clubId) setClubId(resolvedClubId);
          } catch (logoErr) {
            console.error('[seasonPlanPdf] catalog logos failed', logoErr);
          }
        }

        const opponentLogoUrls: Record<string, string> = {};
        for (const r of loaded.rows) {
          if (r.kind === 'tournament') continue;
          const name = (r.opponent || '').trim();
          if (!name || opponentLogoUrls[name]) continue;
          opponentLogoUrls[name] = resolveDisplayOpponentLogo({
            opponent: r.opponent,
            eventLogoUrl: r.opponent_logo_url,
            catalogLogoUrl: logoMap.get(normalizeOpponentKey(r.opponent)),
          });
        }

        if (import.meta.env.DEV) {
          console.debug('[SeasonPlanPDF]', {
            generator: 'downloadSeasonPlanPdf@seasonPlanPdf.ts',
            ageGroup,
            seasonName,
            seasonPhase,
            teamName: ourTeamName,
            rowCount: loaded.rows.length,
          });
        }

        const res = await downloadSeasonPlanPdf({
          rows: loaded.rows,
          teamName: ourTeamName || 'Mannschaft',
          ageGroup,
          seasonName,
          seasonPhase,
          teamLogoUrl: getOurTeamLogoUrl(),
          opponentLogoUrls,
        });
        if (res.error) {
          console.error('[seasonPlanPdf] export failed', res.error);
          setSeasonPlanError('PDF konnte nicht erstellt werden.');
          setError(res.error);
          return;
        }
        setSeasonPlanOpen(false);
      } catch (err) {
        console.error('[seasonPlanPdf] unexpected export error', err);
        setSeasonPlanError('PDF konnte nicht erstellt werden.');
        setError(err instanceof Error ? err.message : String(err));
      } finally {
        setSeasonPlanBusy(false);
        setBusy(false);
      }
    })();
  };

  const editStatusMeta = editFixture ? statusMeta(editFixture.fixture_status) : null;
  const editOefb = editFixture
    ? formatOefbVorgabe(editFixture.source_starts_at ?? editFixture.starts_at)
    : null;
  const editHeaderTitle = editFixture
    ? formatVisibleMatchEncounter({
        isHome: editFixture.is_home,
        ourTeamName,
        opponentName: editFixture.opponent,
      }).home
    : '';
  const editHeaderLogo = editFixture
    ? editFixture.is_home
      ? getOurTeamLogoUrl()
      : resolveDisplayOpponentLogo({
          opponent: editFixture.opponent,
          eventLogoUrl: editFixture.opponent_logo_url,
          catalogLogoUrl: editLogoUrl || catalogLogoMap.get(normalizeOpponentKey(editFixture.opponent)),
        })
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
      className="min-h-[60vh] w-full max-w-full min-w-0 overflow-x-hidden px-3 py-6 pb-[max(7rem,calc(5.75rem+env(safe-area-inset-bottom,0px)))] sm:px-4 md:px-0"
      contentClassName="mx-auto w-full min-w-0 max-w-lg space-y-4 overflow-x-hidden"
    >
      <Link
        to="/app/mehr/seasons"
        className={cn(dsPanelRowClass(), '!min-h-[40px] !py-2 text-sm font-semibold text-white/85')}
      >
        <span className="flex min-w-0 items-center gap-2">
          <ChevronLeft className="h-4 w-4 shrink-0 text-white/50" aria-hidden />
          <span className="truncate">Zurück zur Saisonverwaltung</span>
        </span>
      </Link>

      <SectionTitle subtitle={seasonLabel}>Meisterschaft</SectionTitle>

      <PremiumCard variant="subtle" showAmbientGlow={false} className="min-w-0 space-y-3 overflow-hidden">
        <div className="min-w-0 space-y-1.5">
          <p className="text-sm text-white/80">
            <span className="font-semibold text-white">{counts.total}</span> Spiele
          </p>
          <p className="text-xs text-white/55">
            {counts.agreed + counts.published} von {counts.total} Terminen fertig
          </p>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
            <div
              className="h-full rounded-full bg-emerald-400/70 transition-[width]"
              style={{
                width: `${
                  counts.total > 0
                    ? Math.round(((counts.agreed + counts.published) / counts.total) * 100)
                    : 0
                }%`,
              }}
            />
          </div>
          <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs">
            <span className="text-amber-200">{counts.open} Offen</span>
            <span className="text-emerald-200">{counts.agreed} Vereinbart</span>
            <span className="text-sky-200">{counts.published} Veröffentlicht</span>
          </div>
        </div>

        <div className="flex min-w-0 flex-col gap-2">
          <p className={cn(sectionLabelClass, 'mb-0')}>Dokumente</p>
          <Button
            type="button"
            variant="secondary"
            fullWidth
            className="min-h-[44px] gap-2"
            onClick={() => {
              setPdfError(null);
              setPdfOpen(true);
            }}
          >
            <FileText className="h-4 w-4 shrink-0" aria-hidden />
            Meisterschaftsspielplan PDF
          </Button>
          <Button
            type="button"
            variant="secondary"
            fullWidth
            className="min-h-[44px] gap-2"
            onClick={() => {
              setSeasonPlanError(null);
              setSeasonPlanOpen(true);
            }}
          >
            <FileText className="h-4 w-4 shrink-0" aria-hidden />
            Saisonplan PDF
          </Button>
          {counts.agreed > 0 ? (
            <Button
              type="button"
              variant="primary"
              fullWidth
              disabled={busy}
              onClick={() => setConfirmBulkPublish(true)}
            >
              Alle vereinbarten Spiele veröffentlichen ({counts.agreed})
            </Button>
          ) : null}
        </div>

        <div className="min-w-0 rounded-lg border border-[var(--glass-border)] bg-[var(--glass-bg)]">
          <button
            type="button"
            className="flex min-h-[40px] w-full min-w-0 items-center justify-between gap-2 px-3 py-2 text-left"
            onClick={() => setImportOpen((v) => !v)}
            aria-expanded={importOpen}
          >
            <span className={cn(sectionLabelClass, 'mb-0')}>ÖFB-Spielplan importieren</span>
            <ChevronDown
              className={cn(
                'h-4 w-4 shrink-0 text-white/45 transition-transform',
                importOpen && 'rotate-180',
              )}
              aria-hidden
            />
          </button>
          {importOpen ? (
            <div className="min-w-0 space-y-2 border-t border-white/8 px-3 pb-3 pt-2">
              <label className="block text-xs font-medium text-white/55">ÖFB-Spielplan URL</label>
              <input
                className={cn(inputClass, 'break-all text-[14px]')}
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
              <p className="text-xs text-[var(--text-sub)]">
                Offen und vereinbart bleiben intern. Erst „veröffentlichen“ macht Termine für
                Eltern sichtbar. Bei Erstveröffentlichung erscheint höchstens ein Feed-Hinweis.
              </p>
            </div>
          ) : null}
        </div>
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

      <div className="flex min-w-0 flex-wrap gap-2">
        {(
          [
            { key: 'all', label: 'Alle' },
            { key: 'open', label: 'Offen' },
            { key: 'agreed', label: 'Vereinbart' },
            { key: 'published', label: 'Veröffentlicht' },
          ] as const
        ).map((chip) => (
          <button
            key={chip.key}
            type="button"
            onClick={() => setFilter(chip.key)}
            className={cn(
              'rounded-full border px-3 py-1 text-xs font-semibold transition-colors',
              filter === chip.key
                ? 'border-white/40 bg-white/15 text-white'
                : 'border-white/10 bg-white/5 text-white/55',
            )}
          >
            {chip.label}
          </button>
        ))}
      </div>

      <div className="min-w-0 space-y-2 overflow-x-hidden">
        {filteredFixtures.map((f) => {
          const meta = statusMeta(f.fixture_status);
          const logo = logoFor(f);
          return (
            <PremiumCard
              key={f.id}
              variant="subtle"
              showAmbientGlow={false}
              className={cn('min-w-0 space-y-1.5 overflow-hidden', meta.border)}
            >
              <div className="flex min-w-0 items-start gap-2.5">
                <img
                  src={logo}
                  alt=""
                  className="h-9 w-9 shrink-0 rounded-lg bg-white/5 object-contain"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).src = PLACEHOLDER_LOGO;
                  }}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex min-w-0 items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-white">{f.opponent || 'Gegner'}</p>
                      <p className="text-xs font-medium uppercase tracking-wide text-white/55">
                        {f.is_home ? 'Heim' : 'Auswärts'}
                      </p>
                    </div>
                    <span
                      className={cn(
                        'shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
                        meta.className,
                      )}
                    >
                      {meta.label}
                    </span>
                  </div>
                </div>
              </div>

              {f.fixture_status === 'open' ? (
                <>
                  <p className="min-w-0 break-words text-sm text-white/70">
                    <span className="text-white/40">ÖFB: </span>
                    {formatViennaDateOnly(f.source_starts_at ?? f.starts_at)}
                  </p>
                  <p className="text-sm text-white/70">Uhrzeit noch offen</p>
                  <p className="text-sm text-white/70">
                    <span className="text-white/40">Vereinbart: </span>noch offen
                  </p>
                  {f.location ? (
                    <p className="min-w-0 break-words text-xs text-white/45">{f.location}</p>
                  ) : null}
                </>
              ) : (
                <p className="min-w-0 break-words text-sm text-white/70">
                  {isChampionshipKickoffTimeOpen(f.starts_at, f.fixture_status)
                    ? `${formatViennaDateOnly(f.starts_at)} · offen`
                    : formatOefbDate(f.starts_at)}
                  {f.meeting_at ? ` · Treffpunkt ${utcIsoToViennaTimeHHmm(f.meeting_at)}` : ''}
                  {f.location ? ` · ${f.location}` : ''}
                </p>
              )}

              <div className="flex min-w-0 flex-col gap-2 pt-0.5">
                <Button type="button" variant="secondary" fullWidth onClick={() => openEdit(f)}>
                  Bearbeiten
                </Button>
                {f.fixture_status === 'published' ? (
                  <Link
                    to={`/app/events/${f.id}`}
                    className={cn(
                      inputClass,
                      'inline-flex items-center justify-center text-sm font-semibold no-underline',
                    )}
                  >
                    Termin öffnen
                  </Link>
                ) : null}
                {f.fixture_status === 'agreed' ? (
                  <Button
                    type="button"
                    variant="primary"
                    fullWidth
                    disabled={busy}
                    onClick={() => {
                      setPublishVenueWarn(!f.venue_id && !(f.location ?? '').trim());
                      setConfirmPublishId(f.id);
                    }}
                  >
                    Veröffentlichen
                  </Button>
                ) : null}
              </div>
            </PremiumCard>
          );
        })}
        {!loading && fixtures.length === 0 ? (
          <p className="text-sm text-white/55">Noch keine Meisterschaftsspiele importiert.</p>
        ) : null}
        {!loading && fixtures.length > 0 && filteredFixtures.length === 0 ? (
          <p className="text-sm text-white/55">Keine Spiele in diesem Filter.</p>
        ) : null}
      </div>

      <Modal
        isOpen={Boolean(editFixture && editOefb && editStatusMeta)}
        title="Spiel bearbeiten"
        onClose={closeEdit}
        footer={
          <div className="flex w-full min-w-0 justify-end gap-2">
            <Button type="button" variant="ghost" disabled={busy} onClick={closeEdit}>
              Abbrechen
            </Button>
            <Button type="button" variant="primary" disabled={busy} onClick={() => void saveEdit()}>
              {saveCtaLabel}
            </Button>
          </div>
        }
      >
        {editFixture && editOefb && editStatusMeta ? (
          <div className="min-w-0 max-w-full space-y-4 overflow-x-hidden" lang="de-AT">
            <div className="min-w-0 rounded-lg border border-[var(--glass-border)] bg-[var(--glass-bg)] p-3">
              <div className="flex min-w-0 items-center gap-3">
                <img
                  src={editHeaderLogo}
                  alt=""
                  className="h-10 w-10 shrink-0 rounded-full bg-white/5 object-contain ring-1 ring-white/10"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).src = PLACEHOLDER_LOGO;
                  }}
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-[var(--text-main)]">{editHeaderTitle}</p>
                  <p className="text-xs font-semibold uppercase tracking-wide text-red-400">
                    {editFixture.is_home ? 'Heim' : 'Auswärts'}
                  </p>
                </div>
                <span
                  className={cn(
                    'shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide',
                    editStatusMeta.className,
                  )}
                >
                  {editStatusMeta.label}
                </span>
              </div>
              <div className="mt-2 border-t border-white/8 pt-2">
                <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-white/40">
                  ÖFB-Vorgabe
                </p>
                <p className="text-sm font-medium text-[var(--text-main)]">{editOefb.dateLine}</p>
                <p className="text-sm text-[var(--text-sub)]">{editOefb.timeLine}</p>
                <p className="mt-1 text-xs text-[var(--text-sub)]">{editStatusMeta.hint}</p>
              </div>
            </div>

            <div className="min-w-0 space-y-3">
              <p className={sectionLabelClass}>Termin vereinbaren</p>
              <div className="min-w-0">
                <label className={labelClass} htmlFor="champ-edit-date">
                  Datum
                </label>
                <EventDateField
                  id="champ-edit-date"
                  value={editDate}
                  onChange={setEditDate}
                  disabled={busy}
                  aria-label="Datum"
                />
              </div>
              <div className="min-w-0">
                <label className={labelClass} htmlFor="champ-edit-kickoff">
                  Beginn
                </label>
                <EventTimeField
                  id="champ-edit-kickoff"
                  value={editKickoff}
                  onChange={setEditKickoff}
                  disabled={busy}
                  label="Beginn"
                />
                {!editKickoff ? (
                  <p className="mt-1 text-xs text-[var(--text-sub)]">
                    Uhrzeit noch offen — bewusst setzen
                  </p>
                ) : null}
              </div>
              <div className="min-w-0">
                <label className={labelClass} htmlFor="champ-edit-meetup">
                  Treffpunkt
                </label>
                <EventTimeField
                  id="champ-edit-meetup"
                  value={editMeetup}
                  onChange={setEditMeetup}
                  disabled={busy}
                  label="Treffpunkt"
                />
              </div>
            </div>

            <div className="min-w-0 space-y-2">
              <p className={sectionLabelClass}>Spielort</p>
              <div className="min-w-0 max-w-full overflow-x-hidden">
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
                  labelClass={labelClass}
                  inputClass={inputClass}
                />
              </div>
            </div>

            <div className="min-w-0 rounded-lg border border-[var(--glass-border)] bg-[var(--glass-bg)]">
              <button
                type="button"
                className="flex min-h-[40px] w-full min-w-0 items-center justify-between gap-2 px-3 py-2 text-left"
                onClick={() => setEditLogoOpen((v) => !v)}
                aria-expanded={editLogoOpen}
              >
                <span className={cn(sectionLabelClass, 'mb-0')}>Gegner &amp; Logo</span>
                <ChevronDown
                  className={cn(
                    'h-4 w-4 shrink-0 text-white/45 transition-transform',
                    editLogoOpen && 'rotate-180',
                  )}
                  aria-hidden
                />
              </button>
              {editLogoOpen ? (
                <div className="min-w-0 space-y-2 border-t border-white/8 px-3 pb-3 pt-2">
                  <p className="truncate text-sm font-medium text-[var(--text-main)]">
                    {editFixture.opponent || '—'}
                  </p>
                  <div className="flex min-w-0 items-center gap-3">
                    <img
                      src={resolveDisplayOpponentLogo({
                        opponent: editFixture.opponent,
                        eventLogoUrl: editFixture.opponent_logo_url,
                        catalogLogoUrl:
                          editLogoUrl || catalogLogoMap.get(normalizeOpponentKey(editFixture.opponent)),
                      })}
                      alt=""
                      className="h-12 w-12 shrink-0 rounded-lg bg-white/5 object-contain"
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).src = PLACEHOLDER_LOGO;
                      }}
                    />
                    <div className="min-w-0 flex-1 space-y-2">
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                        <Button
                          type="button"
                          variant="secondary"
                          size="sm"
                          disabled={busy || !clubId}
                          onClick={() => logoFileInputRef.current?.click()}
                        >
                          Bild hochladen
                        </Button>
                        <button
                          type="button"
                          className="text-sm font-medium text-sky-200 underline-offset-2 hover:underline"
                          onClick={applyKnownLogo}
                          disabled={busy}
                        >
                          Bekanntes Logo übernehmen
                        </button>
                        <input
                          ref={logoFileInputRef}
                          type="file"
                          accept="image/png,image/jpeg,image/webp,image/gif"
                          className="hidden"
                          onChange={(e) => void onLogoFileChange(e)}
                        />
                      </div>
                      <label className="block text-xs text-[var(--text-sub)]">
                        Oder Logo-URL verwenden
                      </label>
                      <input
                        className={cn(inputClass, 'text-sm')}
                        placeholder="https://… oder /logos/…"
                        value={editLogoUrl}
                        onChange={(e) => setEditLogoUrl(e.target.value)}
                        disabled={busy}
                      />
                      {!clubId ? (
                        <p className="text-xs text-amber-200/90">
                          Logo-Upload benötigt Migration opponent_catalog / opponent-logos.
                        </p>
                      ) : null}
                    </div>
                  </div>
                </div>
              ) : null}
            </div>

            {canShowPublishInEdit && editFixture.fixture_status !== 'published' ? (
              <div className="min-w-0 space-y-2 rounded-lg border border-red-500/35 bg-red-950/30 p-3">
                <p className="text-xs text-[var(--text-sub)]">
                  Speichern veröffentlicht nicht. Zum Sichtbarmachen für Eltern:
                </p>
                <Button
                  type="button"
                  variant="primary"
                  fullWidth
                  disabled={busy}
                  onClick={requestPublishFromEdit}
                >
                  Als Termin veröffentlichen
                </Button>
              </div>
            ) : null}

            {editError ? (
              <p className="text-sm text-red-300" role="alert">
                {editError}
              </p>
            ) : null}
          </div>
        ) : null}
      </Modal>

      <Modal
        isOpen={Boolean(confirmPublishId)}
        title="Spiel veröffentlichen"
        onClose={() => {
          setConfirmPublishId(null);
          setPublishVenueWarn(false);
        }}
        footer={
          <div className="flex w-full min-w-0 justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => {
                setConfirmPublishId(null);
                setPublishVenueWarn(false);
              }}
            >
              Abbrechen
            </Button>
            <Button
              type="button"
              variant="primary"
              disabled={busy || !confirmPublishId}
              onClick={() => confirmPublishId && void onPublishOne(confirmPublishId)}
            >
              Veröffentlichen
            </Button>
          </div>
        }
      >
        <div className="min-w-0 space-y-3">
          <p className="text-sm text-[var(--text-main)]">Spiel wirklich veröffentlichen?</p>
          <p className="text-sm text-[var(--text-sub)]">
            Der Termin wird anschließend für Spieler und Eltern in Home, Termine und Kalender
            sichtbar.
          </p>
          {publishVenueWarn ? (
            <p className="rounded-lg border border-amber-500/35 bg-amber-950/40 px-3 py-2 text-sm text-amber-100">
              Noch kein Spielort hinterlegt. Du kannst bewusst fortfahren.
            </p>
          ) : null}
        </div>
      </Modal>

      <Modal
        isOpen={confirmBulkPublish}
        title="Spiele veröffentlichen"
        onClose={() => setConfirmBulkPublish(false)}
        footer={
          <div className="flex w-full min-w-0 justify-end gap-2">
            <Button type="button" variant="ghost" onClick={() => setConfirmBulkPublish(false)}>
              Abbrechen
            </Button>
            <Button
              type="button"
              variant="primary"
              disabled={busy}
              onClick={() => void onPublishAllAgreed()}
            >
              Veröffentlichen
            </Button>
          </div>
        }
      >
        <p className="text-sm text-[var(--text-sub)]">
          {counts.agreed} vereinbarte Spiele werden für Spieler und Eltern sichtbar.
        </p>
      </Modal>

      <Modal
        isOpen={pdfOpen}
        title="Meisterschaftsspielplan exportieren"
        onClose={() => {
          if (pdfBusy) return;
          setPdfOpen(false);
          setPdfError(null);
        }}
        footer={
          <div className="flex w-full min-w-0 justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              disabled={pdfBusy}
              onClick={() => {
                setPdfOpen(false);
                setPdfError(null);
              }}
            >
              Abbrechen
            </Button>
            <Button
              type="button"
              variant="primary"
              className="min-h-[44px] gap-2"
              disabled={pdfBusy}
              onClick={onDownloadPdf}
            >
              <FileText className="h-4 w-4" aria-hidden />
              {pdfBusy ? 'PDF wird erstellt …' : 'PDF herunterladen'}
            </Button>
          </div>
        }
      >
        <div className="min-w-0 space-y-2">
          <label className="flex min-h-[44px] min-w-0 items-center gap-2 rounded-lg border border-[var(--glass-border)] bg-[var(--glass-bg)] px-3 py-2 text-sm text-[var(--text-main)]">
            <input
              type="radio"
              name="champ-pdf-mode"
              checked={pdfMode === 'published'}
              disabled={pdfBusy}
              onChange={() => setPdfMode('published')}
            />
            Veröffentlichte Spiele
          </label>
          <label className="flex min-h-[44px] min-w-0 items-center gap-2 rounded-lg border border-[var(--glass-border)] bg-[var(--glass-bg)] px-3 py-2 text-sm text-[var(--text-main)]">
            <input
              type="radio"
              name="champ-pdf-mode"
              checked={pdfMode === 'all'}
              disabled={pdfBusy}
              onChange={() => setPdfMode('all')}
            />
            Gesamter Planungsstand
          </label>
          {pdfError ? (
            <p className="rounded-lg border border-red-500/40 bg-red-950/40 px-3 py-2 text-sm text-red-100">
              {pdfError}
            </p>
          ) : null}
        </div>
      </Modal>

      <Modal
        isOpen={seasonPlanOpen}
        title="Saisonplan exportieren"
        onClose={() => {
          if (seasonPlanBusy) return;
          setSeasonPlanOpen(false);
          setSeasonPlanError(null);
        }}
        footer={
          <div className="flex w-full min-w-0 justify-end gap-2">
            <Button
              type="button"
              variant="ghost"
              disabled={seasonPlanBusy}
              onClick={() => {
                setSeasonPlanOpen(false);
                setSeasonPlanError(null);
              }}
            >
              Abbrechen
            </Button>
            <Button
              type="button"
              variant="primary"
              className="min-h-[44px] gap-2"
              disabled={seasonPlanBusy}
              onClick={onDownloadSeasonPlanPdf}
            >
              <FileText className="h-4 w-4" aria-hidden />
              {seasonPlanBusy ? 'PDF wird erstellt …' : 'PDF herunterladen'}
            </Button>
          </div>
        }
      >
        <div className="min-w-0 space-y-3">
          <p className="text-sm text-[var(--text-sub)]">
            Enthalten:
          </p>
          <ul className="space-y-1.5 text-sm text-[var(--text-main)]">
            <li className="flex items-start gap-2">
              <span className="text-emerald-400" aria-hidden>
                ✓
              </span>
              Meisterschaftsspiele (veröffentlicht)
            </li>
            <li className="flex items-start gap-2">
              <span className="text-emerald-400" aria-hidden>
                ✓
              </span>
              Vorbereitungsspiele
            </li>
            <li className="flex items-start gap-2">
              <span className="text-emerald-400" aria-hidden>
                ✓
              </span>
              Turniere
            </li>
          </ul>
          <p className="text-xs text-[var(--text-sub)]">
            Trainings und interne Meisterschaftstermine (offen/vereinbart) sind nicht enthalten.
          </p>
          {seasonPlanError ? (
            <p className="rounded-lg border border-red-500/40 bg-red-950/40 px-3 py-2 text-sm text-red-100">
              {seasonPlanError}
            </p>
          ) : null}
        </div>
      </Modal>
    </PageShell>
  );
};
