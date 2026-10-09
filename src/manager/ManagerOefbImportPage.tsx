/**
 * STEP 5: ÖFB-Spielplanimport mit Vorschau und manueller Bestätigung.
 * Nutzt bestehende championshipFixtures-/events-Logik — keine parallele Spielelogik.
 */

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { useSession } from '../auth/useSession';
import {
  canPrepareNextSeason,
  formatTeamSeasonContextLabel,
  getSeasonStatusLabel,
  isSeasonArchived,
} from '../lib/seasonLifecycle';
import {
  fetchOefbScheduleFixtures,
  importOefbChampionshipFixtures,
  previewOefbChampionshipImport,
  type OefbImportPreviewRow,
  type OefbImportedFixture,
} from '../lib/championshipFixtures';
import { formatVisibleMatchEncounter } from '../lib/oefbTeamNameNormalize';
import './managerOefbImport.css';
import {
  adminSaveOefbTableSettings,
  getOefbTableSettings,
  parseOefbCompetitionUrl,
  type OefbTableSettings,
} from '../lib/oefbTableSettings';
import { getTeamSeasonWritableState } from '../lib/seasonTransition';
import { supabase } from '../lib/supabaseClient';
import { OefbCompetitionTable } from '../components/schedule/OefbCompetitionTable';
import { useManagerWorkMode } from './ManagerWorkModeContext';
import type { ManagerWorkMode } from './managerWorkMode';

function canAccess(effectiveRole: string, backendRole: string, workMode: ManagerWorkMode): boolean {
  if (workMode === 'platform_admin' && (backendRole ?? '').trim().toLowerCase() === 'admin') {
    return true;
  }
  if (canPrepareNextSeason(effectiveRole) || canPrepareNextSeason(backendRole)) return true;
  const r = (effectiveRole ?? '').trim().toLowerCase();
  return r === 'trainer' || r === 'co_trainer' || r === 'head_coach';
}

function formatViennaDate(iso: string): string {
  try {
    return new Intl.DateTimeFormat('de-AT', {
      timeZone: 'Europe/Vienna',
      weekday: 'short',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    }).format(new Date(iso));
  } catch {
    return '—';
  }
}

function formatViennaTime(iso: string): string {
  try {
    const t = new Intl.DateTimeFormat('de-AT', {
      timeZone: 'Europe/Vienna',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(iso));
    // ÖFB date-only oft als 00:00/23:00 Sentinel — dann Uhrzeit offen
    if (t === '00:00' || t === '23:00') return 'offen';
    return t;
  } catch {
    return '—';
  }
}

function statusChipClass(status: OefbImportPreviewRow['status']): string {
  if (status === 'new') return 'border-emerald-200 bg-emerald-50 text-emerald-800';
  if (status === 'update') return 'border-sky-200 bg-sky-50 text-sky-900';
  if (status === 'existing') return 'border-slate-200 bg-slate-50 text-slate-700';
  if (status === 'protected') return 'border-amber-200 bg-amber-50 text-amber-900';
  return 'border-red-200 bg-red-50 text-red-800';
}

function homeAwayLabel(f: OefbImportedFixture, teamLabel: string): { home: string; away: string } {
  const enc = formatVisibleMatchEncounter({
    isHome: f.is_home,
    ourTeamName: teamLabel,
    opponentName: f.opponent,
    fallbackOur: 'Eigene Mannschaft',
  });
  return { home: enc.home, away: enc.away };
}

function previewStatusDetail(row: OefbImportPreviewRow): string | null {
  if (row.nameCorrection) {
    if (row.status === 'protected') {
      return `Termin geschützt · Name: ${row.nameCorrection}`;
    }
    return row.nameCorrection;
  }
  if (row.message) return row.message;
  return null;
}

export function ManagerOefbImportPage(): React.ReactElement {
  const { seasonId } = useParams<{ seasonId: string }>();
  const { user, effectiveRole, backendRole, setViewTeamSeasonId } = useSession();
  const { workMode } = useManagerWorkMode();
  const allowed = canAccess(effectiveRole, backendRole, workMode);

  const [meta, setMeta] = useState<{
    displayName: string;
    status: string;
    ageGroup: string | null;
    teamName: string | null;
  } | null>(null);
  const [writableMessage, setWritableMessage] = useState<string | null>(null);
  const [archived, setArchived] = useState(false);
  const [loadingMeta, setLoadingMeta] = useState(true);
  const [metaError, setMetaError] = useState<string | null>(null);

  // Keine fremde Mannschaft vorausfüllen: der Admin muss die URL der Zielsaison bestätigen.
  const [importUrl, setImportUrl] = useState('');
  const [oefbTeamName, setOefbTeamName] = useState('');
  const [previewRows, setPreviewRows] = useState<OefbImportPreviewRow[]>([]);
  const [previewFixtures, setPreviewFixtures] = useState<OefbImportedFixture[]>([]);
  const [previewBusy, setPreviewBusy] = useState(false);
  const [importBusy, setImportBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);
  const [tableUrl, setTableUrl] = useState('');
  const [tableTeamName, setTableTeamName] = useState('');
  const [savedTable, setSavedTable] = useState<OefbTableSettings | null>(null);
  const [tableBusy, setTableBusy] = useState(false);
  const [tableError, setTableError] = useState<string | null>(null);
  const [tableNotice, setTableNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!seasonId) return;
    setViewTeamSeasonId(seasonId);
  }, [seasonId, setViewTeamSeasonId]);

  useEffect(() => {
    setImportUrl('');
    setOefbTeamName('');
    setPreviewRows([]);
    setPreviewFixtures([]);
    setConfirmed(false);
    setInfo(null);
    setError(null);
  }, [seasonId]);

  useEffect(() => {
    let cancelled = false;
    setSavedTable(null);
    setTableUrl('');
    setTableTeamName('');
    setTableError(null);
    setTableNotice(null);
    if (!allowed || !seasonId) return;
    void getOefbTableSettings(seasonId).then((result) => {
      if (cancelled) return;
      if (result.error) setTableError(result.error);
      if (result.data) {
        setSavedTable(result.data);
        setTableUrl(result.data.sourceUrl);
        setTableTeamName(result.data.teamName);
      }
    });
    return () => { cancelled = true; };
  }, [allowed, seasonId]);

  const loadMeta = useCallback(async () => {
    if (!seasonId) {
      setLoadingMeta(false);
      return;
    }
    setLoadingMeta(true);
    setMetaError(null);
    const [{ data: ts, error: tsErr }, writable] = await Promise.all([
      supabase
        .from('team_seasons')
        .select('id, status, display_name, age_group, archived_at, seasons ( name ), teams ( name )')
        .eq('id', seasonId)
        .maybeSingle(),
      getTeamSeasonWritableState(seasonId),
    ]);
    if (tsErr) {
      setMetaError(tsErr.message);
      setLoadingMeta(false);
      return;
    }
    if (!ts) {
      setMetaError('Saison nicht gefunden.');
      setLoadingMeta(false);
      return;
    }
    const team = Array.isArray(ts.teams) ? ts.teams[0] : ts.teams;
    const season = Array.isArray(ts.seasons) ? ts.seasons[0] : ts.seasons;
    const teamName = team?.name ? String(team.name) : null;
    const status = String(ts.status ?? 'active');
    const displayName =
      formatTeamSeasonContextLabel({
        displayName: String(ts.display_name ?? '').trim() || null,
        ageGroup: ts.age_group ? String(ts.age_group) : null,
        teamName,
        seasonName: season?.name ? String(season.name) : null,
        status,
      }) ||
      'Saison';
    setMeta({
      displayName,
      status,
      ageGroup: ts.age_group ? String(ts.age_group) : null,
      teamName,
    });
    setArchived(isSeasonArchived(status) || Boolean((ts as { archived_at?: string | null }).archived_at));
    if ('error' in writable) setWritableMessage(writable.error);
    else if (!writable.writable) setWritableMessage(writable.message);
    else setWritableMessage(null);
    setLoadingMeta(false);
  }, [seasonId]);

  useEffect(() => {
    void loadMeta();
  }, [loadMeta]);

  const counts = useMemo(() => {
    const c = { new: 0, update: 0, existing: 0, protected: 0, error: 0 };
    for (const r of previewRows) c[r.status] += 1;
    return c;
  }, [previewRows]);

  const canPreview = Boolean(seasonId && meta) && !loadingMeta && !archived && !writableMessage && !previewBusy && !importBusy;
  const canImport =
    canPreview &&
    confirmed &&
    previewFixtures.length > 0 &&
    previewRows.some((r) => r.willWrite) &&
    !importBusy;

  const onPreview = async () => {
    if (!seasonId || !canPreview) return;
    const url = importUrl.trim();
    if (!url) {
      setError('Bitte die ÖFB-Spielplan-URL der Mannschaft eintragen.');
      setInfo(null);
      setPreviewRows([]);
      setPreviewFixtures([]);
      setConfirmed(false);
      return;
    }
    if (!oefbTeamName.trim()) {
      setError('Bitte den Mannschaftsnamen laut ÖFB-Spielplan eingeben, damit Heim und Auswärts richtig erkannt werden.');
      return;
    }
    setPreviewBusy(true);
    setError(null);
    setInfo(null);
    setConfirmed(false);
    setPreviewRows([]);
    setPreviewFixtures([]);

    const fetched = await fetchOefbScheduleFixtures({
      url,
      ourTeamHints: [oefbTeamName.trim()],
    });
    if (fetched.error) {
      setPreviewBusy(false);
      setError(fetched.error);
      return;
    }
    if (fetched.fixtures.length === 0) {
      setPreviewBusy(false);
      setInfo('Keine Ligaspiel-Termine im ÖFB-Spielplan gefunden.');
      return;
    }

    const preview = await previewOefbChampionshipImport({
      teamSeasonId: seasonId,
      fixtures: fetched.fixtures,
      insertOnly: true,
    });
    setPreviewBusy(false);
    if (preview.error) {
      setError(preview.error);
      return;
    }
    setPreviewFixtures(fetched.fixtures);
    setPreviewRows(preview.rows);
    setInfo(
      `${preview.rows.length} Spiele erkannt · ${preview.counts.new} neu · ${preview.counts.existing} vorhanden · ${preview.counts.protected} mögliche Dubletten (übersprungen) · ${preview.counts.error} Fehler`,
    );
  };

  const onImport = async () => {
    if (!seasonId || !canImport) return;
    setImportBusy(true);
    setError(null);
    const res = await importOefbChampionshipFixtures({
      teamSeasonId: seasonId,
      fixtures: previewFixtures,
      createdBy: user?.id ?? null,
      insertOnly: true,
    });
    setImportBusy(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    setInfo(
      `Import abgeschlossen: ${res.inserted} neu, ${res.skippedExisting} vorhandene Spiele unverändert gelassen.`,
    );
    setConfirmed(false);
    // Vorschau nach Import neu laden
    const preview = await previewOefbChampionshipImport({
      teamSeasonId: seasonId,
      fixtures: previewFixtures,
      insertOnly: true,
    });
    if (!preview.error) setPreviewRows(preview.rows);
  };

  const onSaveTable = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!seasonId || workMode !== 'platform_admin' || backendRole?.trim().toLowerCase() !== 'admin' || tableBusy) return;
    setTableError(null);
    setTableNotice(null);
    if (!parseOefbCompetitionUrl(tableUrl) || !tableTeamName.trim()) {
      setTableError('Bitte einen ÖFB-Bewerbslink und den eigenen Mannschaftsnamen eingeben.');
      return;
    }
    setTableBusy(true);
    try {
      const saved = await adminSaveOefbTableSettings({ teamSeasonId: seasonId, sourceUrl: tableUrl, teamName: tableTeamName });
      if (saved.error) setTableError(saved.error);
      else {
        setSavedTable(saved.data);
        setTableNotice('ÖFB-Tabelle für diese Mannschaftssaison gespeichert. Die App lädt den aktuellen Stand vom ÖFB.');
      }
    } catch (cause) {
      setTableError(cause instanceof Error ? cause.message : 'Tabelle konnte nicht gespeichert werden.');
    } finally {
      setTableBusy(false);
    }
  };

  if (!allowed) return <Navigate to="/manager" replace />;
  if (!seasonId) return <Navigate to="/manager/saisons" replace />;

  const teamLabel = oefbTeamName.trim() || meta?.teamName || meta?.displayName || 'Eigene Mannschaft';

  return (
    <div className="manager-oefb-import space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link to="/manager/saisons/verwaltung" className="text-[13px] font-semibold text-red-700 hover:underline">
            ← Saison &amp; Meisterschaft
          </Link>
          <h1 className="mt-2 text-[22px] font-semibold tracking-tight text-slate-900">
            ÖFB-Spielplan importieren
          </h1>
          <p className="mt-1 max-w-3xl text-[14px] text-slate-600">
            Vorschau vor dem Schreiben. Dubletten werden saisonbezogen über die ÖFB-ID erkannt.
            Dieser Einrichtungsimport legt nur neue Spiele an und verändert vorhandene Termine nicht.
          </p>
        </div>
      </div>

      {loadingMeta ? <p className="text-[13px] text-slate-400">Saison wird geladen…</p> : null}
      <details className="space-y-2 rounded-2xl border border-slate-200 bg-white p-4 text-[13px] text-slate-600 xl:max-w-3xl">
        <summary className="min-h-11 cursor-pointer content-center font-semibold text-slate-900">Hinweise: Herbst, Frühjahr oder Einstieg während der Saison</summary>
        <p>Herbst und Frühjahr gehören zur selben Jahressaison. Den Frühjahrs-Spielplan deshalb erneut in die laufende Saison importieren; die Saison erst nach dem Frühjahr abschließen.</p>
        <p>Auch bei einem Einstieg während der Saison kannst du den Spielplan hier laden. Prüfe vor dem Bestätigen die Zielsaison und die erkannten Spiele. Bereits importierte ÖFB-Spiele werden anhand ihrer ÖFB-ID erkannt.</p>
        <p className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-amber-950">Dieser Import übernimmt Spieltermine. Vergangene Endstände, Torschützen und Spielstatistiken werden derzeit nicht automatisch übernommen.</p>
      </details>
      {metaError ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-800">
          {metaError}
        </div>
      ) : null}

      {meta ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-[0_1px_2px_rgba(15,23,42,0.04)] xl:max-w-3xl">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">Zielsaison</p>
          <p className="mt-1 text-[16px] font-semibold text-slate-900">{meta.displayName}</p>
          <p className="mt-1 text-[13px] text-slate-600">
            {getSeasonStatusLabel(meta.status)}
            {meta.ageGroup ? ` · ${meta.ageGroup}` : ''}
          </p>
          {archived || writableMessage ? (
            <p className="mt-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-[13px] text-amber-950">
              {writableMessage ??
                'Diese Saison ist abgeschlossen und darf nicht beschrieben werden. Import nur in eine aktive oder Entwurfs-Saison.'}
            </p>
          ) : (
            <p className="mt-3 text-[12px] text-slate-500">
              Alle importierten Spiele werden ausschließlich mit dieser Saison verknüpft. Frühere
              Saisons bleiben unverändert.
            </p>
          )}
        </section>
      ) : null}

      {meta && workMode === 'platform_admin' && backendRole?.trim().toLowerCase() === 'admin' ? (
        <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 xl:max-w-3xl">
          <div>
            <h2 className="text-[16px] font-semibold text-slate-900">ÖFB-Tabelle der Saison</h2>
            <p className="mt-1 text-[12px] text-slate-600">Bewerbslink speichern; die Tabelle wird in der App regelmäßig aktuell vom ÖFB geladen. Ohne Zuordnung erscheint kein Tabellen-Tab.</p>
          </div>
          <form onSubmit={(event) => void onSaveTable(event)} className="space-y-3">
            <label className="block text-[13px] font-semibold text-slate-800" htmlFor="oefb-table-url">ÖFB-Bewerbslink</label>
            <input id="oefb-table-url" type="url" value={tableUrl} onChange={(e) => setTableUrl(e.target.value)} placeholder="https://www.oefb.at/bewerbe/Bewerb/232775" disabled={tableBusy} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-[14px] text-slate-900" />
            <label className="block text-[13px] font-semibold text-slate-800" htmlFor="oefb-table-team">Eigener Mannschaftsname in der Tabelle</label>
            <input id="oefb-table-team" value={tableTeamName} onChange={(e) => setTableTeamName(e.target.value)} placeholder="z. B. SPG Rohrbach" disabled={tableBusy} className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-[14px] text-slate-900" />
            <button type="submit" disabled={tableBusy || !tableUrl.trim() || !tableTeamName.trim()} className="rounded-xl bg-red-700 px-4 py-2.5 text-[13px] font-semibold text-white disabled:opacity-50">{tableBusy ? 'Speichern…' : 'Tabelle zuordnen'}</button>
          </form>
          {tableError ? <p role="alert" className="text-[13px] text-red-700">{tableError}</p> : null}
          {tableNotice ? <p role="status" className="text-[13px] text-emerald-700">{tableNotice}</p> : null}
          {savedTable ? <div className="rounded-xl bg-slate-900 p-3"><OefbCompetitionTable competitionId={savedTable.competitionId} sourceUrl={savedTable.sourceUrl} ourTeam={savedTable.teamName} /></div> : null}
        </section>
      ) : null}

      {!archived && !writableMessage && meta ? (
        <section className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 xl:max-w-3xl">
          <label className="block text-[13px] font-semibold text-slate-800" htmlFor="oefb-url">
            ÖFB-Spielplan-URL
          </label>
          <input
            id="oefb-url"
            type="url"
            inputMode="url"
            autoCapitalize="none"
            spellCheck={false}
            value={importUrl}
            disabled={previewBusy || importBusy}
            onChange={(e) => {
              setImportUrl(e.target.value);
              setConfirmed(false);
              setPreviewRows([]);
              setPreviewFixtures([]);
            }}
            placeholder="https://vereine.oefb.at/…/Spiele"
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-[14px] text-slate-900 outline-none focus:border-red-400"
          />
          <p className="text-[12px] text-slate-500">
            Bitte die Mannschafts-URL aus dem ÖFB-Vereinsbereich verwenden. Ohne gültige URL wird
            nichts abgerufen.
          </p>
          <label className="block text-[13px] font-semibold text-slate-800" htmlFor="oefb-team-name">
            Eigener Mannschaftsname laut ÖFB
          </label>
          <input
            id="oefb-team-name"
            value={oefbTeamName}
            onChange={(e) => { setOefbTeamName(e.target.value); setConfirmed(false); setPreviewRows([]); setPreviewFixtures([]); }}
            placeholder={meta.teamName ?? 'z. B. NSG Gölsental'}
            disabled={previewBusy || importBusy}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-[14px] text-slate-900 outline-none focus:border-red-400"
          />
          <p className="text-[12px] text-slate-500">Dieser Name bestimmt die Heim-/Auswärts-Zuordnung. Bitte in der Vorschau kontrollieren.</p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={!canPreview}
              onClick={() => void onPreview()}
              className="inline-flex min-h-[44px] items-center rounded-full bg-red-700 px-4 text-[13px] font-semibold text-white disabled:opacity-50"
            >
              {previewBusy ? 'Lade Vorschau…' : 'Vorschau laden'}
            </button>
            <button
              type="button"
              disabled={importBusy || previewBusy}
              onClick={() => {
                setImportUrl('');
                setPreviewRows([]);
                setPreviewFixtures([]);
                setConfirmed(false);
                setInfo(null);
                setError(null);
              }}
              className="inline-flex min-h-[44px] items-center rounded-full border border-slate-200 px-4 text-[13px] font-semibold text-slate-700 disabled:opacity-50"
            >
              URL leeren
            </button>
          </div>
        </section>
      ) : null}

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-[13px] text-red-800" role="alert">
          {error}
        </div>
      ) : null}
      {info ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-[13px] text-emerald-900">
          {info}
        </div>
      ) : null}

      {previewRows.length > 0 ? (
        <section className="space-y-3">
          <div className="flex flex-wrap gap-2 text-[12px]">
            <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-1 font-semibold text-emerald-800">
              {counts.new} neu
            </span>
            <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 font-semibold text-slate-700">
              {counts.existing} vorhanden
            </span>
            <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 font-semibold text-amber-900">
              {counts.protected} mögliche Dubletten
            </span>
            {counts.error > 0 ? (
              <span className="rounded-full border border-red-200 bg-red-50 px-2.5 py-1 font-semibold text-red-800">
                {counts.error} Fehler
              </span>
            ) : null}
          </div>

          <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white">
            <table className="min-w-full text-left text-[13px]">
              <thead className="border-b border-slate-200 bg-slate-50 text-[11px] uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-3 py-2 font-semibold">Datum</th>
                  <th className="px-3 py-2 font-semibold">Zeit</th>
                  <th className="px-3 py-2 font-semibold">Heim</th>
                  <th className="px-3 py-2 font-semibold">Auswärts</th>
                  <th className="px-3 py-2 font-semibold">Ort</th>
                  <th className="px-3 py-2 font-semibold">Bewerb</th>
                  <th className="px-3 py-2 font-semibold">Status</th>
                  <th className="px-3 py-2 font-semibold">ÖFB</th>
                </tr>
              </thead>
              <tbody>
                {previewRows.map((row) => {
                  const { home, away } = homeAwayLabel(row.fixture, teamLabel);
                  return (
                    <tr key={row.fixture.external_id || `${row.fixture.starts_at}-${row.fixture.opponent}`} className="border-b border-slate-100 align-top">
                      <td className="whitespace-nowrap px-3 py-2 text-slate-800">
                        {formatViennaDate(row.fixture.starts_at)}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-slate-700">
                        {formatViennaTime(row.fixture.starts_at)}
                      </td>
                      <td className="px-3 py-2 font-medium text-slate-900">{home}</td>
                      <td className="px-3 py-2 font-medium text-slate-900">{away}</td>
                      <td className="px-3 py-2 text-slate-600">{row.fixture.location ?? '—'}</td>
                      <td className="px-3 py-2 text-slate-600">{row.fixture.competition ?? '—'}</td>
                      <td className="px-3 py-2">
                        <div className="space-y-1">
                          <span
                            className={`inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold ${statusChipClass(row.status)}`}
                            title={row.message ?? undefined}
                          >
                            {row.statusLabel}
                          </span>
                          {previewStatusDetail(row) ? (
                            <p className="max-w-[16rem] text-[11px] leading-snug text-slate-500">
                              {previewStatusDetail(row)}
                            </p>
                          ) : null}
                        </div>
                      </td>
                      <td className="px-3 py-2">
                        {row.fixture.external_url ? (
                          <a
                            href={row.fixture.external_url}
                            target="_blank"
                            rel="noreferrer"
                            className="font-semibold text-red-700 hover:underline"
                          >
                            Link
                          </a>
                        ) : (
                          '—'
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <label className="flex items-start gap-2 rounded-xl border border-slate-200 bg-white px-3 py-3 text-[13px] text-slate-800">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={confirmed}
              disabled={importBusy || previewBusy}
              onChange={(e) => setConfirmed(e.target.checked)}
            />
            <span>
              Ich habe die Vorschau geprüft. Nur neue ÖFB-Spiele dürfen in die Zielsaison angelegt
              werden. Bereits vorhandene Termine bleiben vollständig unverändert.
            </span>
          </label>

          <button
            type="button"
            disabled={!canImport}
            onClick={() => void onImport()}
            className="inline-flex min-h-[46px] items-center rounded-full bg-red-700 px-5 text-[14px] font-semibold text-white disabled:opacity-50"
          >
            {importBusy ? 'Importiere…' : 'Import bestätigen und schreiben'}
          </button>
          {!confirmed ? (
            <p className="text-[12px] text-slate-500">Ohne Bestätigung wird nichts geschrieben.</p>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
