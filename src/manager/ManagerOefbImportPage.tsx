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
  DEFAULT_OEFB_SCHEDULE_URL,
  fetchOefbScheduleFixtures,
  importOefbChampionshipFixtures,
  previewOefbChampionshipImport,
  type OefbImportPreviewRow,
  type OefbImportedFixture,
} from '../lib/championshipFixtures';
import { formatVisibleMatchEncounter } from '../lib/oefbTeamNameNormalize';
import { getTeamSeasonWritableState } from '../lib/seasonTransition';
import { supabase } from '../lib/supabaseClient';

import { supabase } from '../lib/supabaseClient';
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

  const [importUrl, setImportUrl] = useState(DEFAULT_OEFB_SCHEDULE_URL);
  const [previewRows, setPreviewRows] = useState<OefbImportPreviewRow[]>([]);
  const [previewFixtures, setPreviewFixtures] = useState<OefbImportedFixture[]>([]);
  const [previewBusy, setPreviewBusy] = useState(false);
  const [importBusy, setImportBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);

  useEffect(() => {
    if (!seasonId) return;
    setViewTeamSeasonId(seasonId);
  }, [seasonId, setViewTeamSeasonId]);

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
    const displayName =
      formatTeamSeasonContextLabel({
        displayName: String(ts.display_name ?? '').trim() || null,
        ageGroup: ts.age_group ? String(ts.age_group) : null,
        teamName,
        seasonName: season?.name ? String(season.name) : null,
        status,
      }) ||
      'Saison';
    const status = String(ts.status ?? 'active');
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

  const canPreview = Boolean(seasonId) && !archived && !writableMessage && !previewBusy && !importBusy;
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
    setPreviewBusy(true);
    setError(null);
    setInfo(null);
    setConfirmed(false);
    setPreviewRows([]);
    setPreviewFixtures([]);

    const teamHints = [meta?.teamName, meta?.ageGroup, 'SPG Rohrbach', 'Rohrbach'].filter(
      (x): x is string => Boolean(x && String(x).trim()),
    );
    const fetched = await fetchOefbScheduleFixtures({
      url,
      ourTeamHints: teamHints.length ? teamHints : ['SPG Rohrbach', 'Rohrbach'],
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
    });
    setPreviewBusy(false);
    if (preview.error) {
      setError(preview.error);
      return;
    }
    setPreviewFixtures(fetched.fixtures);
    setPreviewRows(preview.rows);
    setInfo(
      `${preview.rows.length} Spiele erkannt · ${preview.counts.new} neu · ${preview.counts.update} Aktualisierung · ${preview.counts.existing} vorhanden · ${preview.counts.protected} geschützt · ${preview.counts.error} Fehler`,
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
    });
    setImportBusy(false);
    if (res.error) {
      setError(res.error);
      return;
    }
    setInfo(
      `Import abgeschlossen: ${res.inserted} neu, ${res.updated} aktualisiert, ${res.skippedProtected} geschützt (Kickoff/Ort unverändert).`,
    );
    setConfirmed(false);
    // Vorschau nach Import neu laden
    const preview = await previewOefbChampionshipImport({
      teamSeasonId: seasonId,
      fixtures: previewFixtures,
    });
    if (!preview.error) setPreviewRows(preview.rows);
  };

  if (!allowed) return <Navigate to="/manager" replace />;
  if (!seasonId) return <Navigate to="/manager/saisons" replace />;

  const teamLabel = meta?.teamName ?? meta?.displayName ?? 'Eigene Mannschaft';

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <Link to="/manager/saisons" className="text-[13px] font-semibold text-red-700 hover:underline">
            ← Saisonen
          </Link>
          <h1 className="mt-2 text-[22px] font-semibold tracking-tight text-slate-900">
            ÖFB-Spielplan importieren
          </h1>
          <p className="mt-1 max-w-3xl text-[14px] text-slate-600">
            Vorschau vor dem Schreiben. Dubletten werden saisonbezogen über die ÖFB-ID erkannt.
            Vereinbarte oder veröffentlichte Termine bleiben geschützt.
          </p>
        </div>
      </div>

      {loadingMeta ? <p className="text-[13px] text-slate-400">Saison wird geladen…</p> : null}
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
            }}
            placeholder="https://vereine.oefb.at/…/Spiele"
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-[14px] text-slate-900 outline-none focus:border-red-400"
          />
          <p className="text-[12px] text-slate-500">
            Bitte die Mannschafts-URL aus dem ÖFB-Vereinsbereich verwenden. Ohne gültige URL wird
            nichts abgerufen.
          </p>
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
            <span className="rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 font-semibold text-sky-900">
              {counts.update} Aktualisierung
            </span>
            <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 font-semibold text-slate-700">
              {counts.existing} vorhanden
            </span>
            <span className="rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 font-semibold text-amber-900">
              {counts.protected} geschützt
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
              Ich habe die Vorschau geprüft. Neue und aktualisierbare Spiele dürfen in die Zielsaison
              geschrieben werden. Geschützte Termine (vereinbart/veröffentlicht) behalten Kickoff, Ort
              und Status — sichtbare Bezeichnungen (ohne „U11“) dürfen trotzdem bereinigt werden.
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
