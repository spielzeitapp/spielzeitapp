/**
 * Read-only Team-Spielplan für Eltern, Trainer, Co-Trainer, Admin.
 * Nur veröffentlichte Meisterschaft + weitere Saisontermine (Turniere / Vorbereitung).
 * Keine Management-Rechte nötig für Ansicht / PDF.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, FileText, Settings2 } from 'lucide-react';
import { useSession } from '../auth/useSession';
import {
  fetchChampionshipPdfSeasonMeta,
  listChampionshipFixtures,
  type ChampionshipFixture,
} from '../lib/championshipFixtures';
import { downloadChampionshipSchedulePdf, formatPdfDateWithWeekday } from '../lib/championshipPdf';
import {
  fetchOpponentCatalogLogoMap,
  resolveClubIdFromTeamSeason,
  resolveDisplayOpponentLogo,
} from '../lib/opponentCatalog';
import { canPrepareNextSeason } from '../lib/seasonLifecycle';
import { loadSeasonPlanRows } from '../lib/seasonPlanData';
import { downloadSeasonPlanPdf, type SeasonPlanRow } from '../lib/seasonPlanPdf';
import { resolveSeasonPhase, type SeasonPhase } from '../lib/seasonPhase';
import { normalizeOpponentKey } from '../lib/teamVenues';
import { getOurTeamDisplayName, getOurTeamLogoUrl, PLACEHOLDER_LOGO } from '../lib/teamLogos';
import {
  isChampionshipKickoffTimeOpen,
  utcIsoToViennaTimeHHmm,
} from '../lib/viennaTime';
import { dsPanelRowClass } from '../lib/premiumDesignSystem';
import { PageShell, PremiumButton, PremiumCard, SectionTitle } from '../ui';
import { cn } from '../ui/lib/cn';

function canManageChampionship(effectiveRole: string, backendRole: string): boolean {
  if ((backendRole ?? '').trim().toLowerCase() === 'admin') return true;
  if (canPrepareNextSeason(effectiveRole) || canPrepareNextSeason(backendRole)) return true;
  const r = (effectiveRole ?? '').trim().toLowerCase();
  return r === 'trainer' || r === 'co_trainer' || r === 'head_coach';
}

function kickoffLabel(f: ChampionshipFixture): string {
  if (!f.starts_at || isChampionshipKickoffTimeOpen(f.starts_at, f.fixture_status)) return 'offen';
  return utcIsoToViennaTimeHHmm(f.starts_at) || 'offen';
}

function encounterLine(
  f: ChampionshipFixture,
  ourTeamName: string,
): string {
  const us = (ourTeamName || 'Heim').trim() || 'Heim';
  const them = (f.opponent || 'Gegner').trim() || 'Gegner';
  return f.is_home === false ? `${them} – ${us}` : `${us} – ${them}`;
}

function otherEventTitle(row: SeasonPlanRow, ourTeamName: string): string {
  if (row.kind === 'tournament') return row.title || 'Turnier';
  if (row.opponent) {
    const us = (ourTeamName || 'Heim').trim() || 'Heim';
    const them = row.opponent.trim();
    return row.is_home === false ? `${them} – ${us}` : `${us} – ${them}`;
  }
  return row.title || 'Termin';
}

export const TeamSchedulePage: React.FC = () => {
  const {
    selectedTeamSeasonId,
    effectiveRole,
    backendRole,
  } = useSession();
  const showManage = canManageChampionship(effectiveRole, backendRole);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fixtures, setFixtures] = useState<ChampionshipFixture[]>([]);
  const [otherRows, setOtherRows] = useState<SeasonPlanRow[]>([]);
  const [ageGroup, setAgeGroup] = useState<string | null>(null);
  const [seasonName, setSeasonName] = useState<string | null>(null);
  const [seasonPhase, setSeasonPhase] = useState<SeasonPhase | null>(null);
  const [clubId, setClubId] = useState<string | null>(null);
  const [catalogLogoMap, setCatalogLogoMap] = useState<Map<string, string>>(new Map());
  const [pdfBusy, setPdfBusy] = useState<'champ' | 'season' | null>(null);
  const [pdfError, setPdfError] = useState<string | null>(null);

  const ourTeamName = getOurTeamDisplayName();

  const reload = useCallback(async (teamSeasonId: string) => {
    setLoading(true);
    setError(null);
    const [meta, list, seasonRows, club] = await Promise.all([
      fetchChampionshipPdfSeasonMeta(teamSeasonId),
      listChampionshipFixtures(teamSeasonId),
      loadSeasonPlanRows({ teamSeasonId, ourTeamName }),
      resolveClubIdFromTeamSeason(teamSeasonId),
    ]);
    if (meta.error) {
      setError(meta.error);
    }
    setAgeGroup(meta.ageGroup);
    setSeasonName(meta.seasonName);
    setSeasonPhase(meta.seasonPhase);
    if (list.error) {
      setError(list.error);
      setFixtures([]);
    } else {
      setFixtures(list.data);
    }
    if (seasonRows.error) {
      setOtherRows([]);
    } else {
      setOtherRows(
        (seasonRows.rows ?? []).filter(
          (r) => r.kind === 'tournament' || r.kind === 'friendly',
        ),
      );
    }
    setClubId(club);
    if (club && list.data.length > 0) {
      try {
        const map = await fetchOpponentCatalogLogoMap(
          club,
          list.data.map((f) => f.opponent ?? ''),
        );
        setCatalogLogoMap(map);
      } catch {
        setCatalogLogoMap(new Map());
      }
    } else {
      setCatalogLogoMap(new Map());
    }
    setLoading(false);
  }, [ourTeamName]);

  useEffect(() => {
    if (!selectedTeamSeasonId) {
      setLoading(false);
      setFixtures([]);
      setOtherRows([]);
      return;
    }
    void reload(selectedTeamSeasonId);
  }, [selectedTeamSeasonId, reload]);

  const published = useMemo(
    () =>
      fixtures
        .filter((f) => f.fixture_status === 'published')
        .sort((a, b) => (a.starts_at ?? '').localeCompare(b.starts_at ?? '')),
    [fixtures],
  );

  const resolvedPhase = useMemo(
    () => resolveSeasonPhase({ seasonName, storedPhase: seasonPhase }),
    [seasonName, seasonPhase],
  );

  const headerTitle = useMemo(() => {
    const age = (ageGroup ?? '').trim() || 'Team';
    const phase = resolvedPhase.label ? ` SPIELPLAN ${resolvedPhase.label.toUpperCase()}` : ' SPIELPLAN';
    return `${age} –${phase}`;
  }, [ageGroup, resolvedPhase.label]);

  const subtitle = useMemo(() => {
    const season = (seasonName ?? '').trim();
    const club = ourTeamName.replace(/^U\d{1,2}[a-z]?\s+/i, '').trim() || ourTeamName;
    return [season ? `Saison ${season}` : null, club || null].filter(Boolean).join(' · ');
  }, [seasonName, ourTeamName]);

  const logoUrlFor = (opponent: string | null | undefined, eventLogo: string | null | undefined) =>
    resolveDisplayOpponentLogo({
      opponent,
      eventLogoUrl: eventLogo,
      catalogLogoUrl: catalogLogoMap.get(normalizeOpponentKey(opponent)),
    });

  const onDownloadChampionshipPdf = () => {
    if (!selectedTeamSeasonId) return;
    void (async () => {
      setPdfBusy('champ');
      setPdfError(null);
      try {
        const meta = await fetchChampionshipPdfSeasonMeta(selectedTeamSeasonId);
        const fresh = await listChampionshipFixtures(selectedTeamSeasonId);
        if (fresh.error) {
          setPdfError(fresh.error);
          return;
        }
        let logoMap = catalogLogoMap;
        if (clubId) {
          try {
            logoMap = await fetchOpponentCatalogLogoMap(
              clubId,
              fresh.data.map((f) => f.opponent ?? ''),
            );
            setCatalogLogoMap(logoMap);
          } catch {
            /* optional */
          }
        }
        const opponentLogoUrls: Record<string, string> = {};
        for (const f of fresh.data) {
          const name = (f.opponent || '').trim();
          if (!name || opponentLogoUrls[name]) continue;
          opponentLogoUrls[name] = resolveDisplayOpponentLogo({
            opponent: f.opponent,
            eventLogoUrl: f.opponent_logo_url,
            catalogLogoUrl: logoMap.get(normalizeOpponentKey(f.opponent)),
          });
        }
        const res = await downloadChampionshipSchedulePdf({
          fixtures: fresh.data,
          mode: 'published',
          teamName: ourTeamName || 'Mannschaft',
          ageGroup: meta.ageGroup || ageGroup,
          seasonName: meta.seasonName || seasonName,
          seasonPhase: meta.seasonPhase ?? seasonPhase,
          teamLogoUrl: getOurTeamLogoUrl(),
          opponentLogoUrls,
        });
        if (res.error) setPdfError(res.error);
      } catch (err) {
        setPdfError(err instanceof Error ? err.message : String(err));
      } finally {
        setPdfBusy(null);
      }
    })();
  };

  const onDownloadSeasonPlanPdf = () => {
    if (!selectedTeamSeasonId) return;
    void (async () => {
      setPdfBusy('season');
      setPdfError(null);
      try {
        const meta = await fetchChampionshipPdfSeasonMeta(selectedTeamSeasonId);
        const loaded = await loadSeasonPlanRows({
          teamSeasonId: selectedTeamSeasonId,
          ourTeamName,
        });
        if (loaded.error) {
          setPdfError(loaded.error);
          return;
        }
        const opponentLogoUrls: Record<string, string> = {};
        for (const row of loaded.rows) {
          const name = (row.opponent || '').trim();
          if (!name || opponentLogoUrls[name]) continue;
          opponentLogoUrls[name] = resolveDisplayOpponentLogo({
            opponent: row.opponent,
            eventLogoUrl: row.opponent_logo_url,
            catalogLogoUrl: catalogLogoMap.get(normalizeOpponentKey(row.opponent)),
          });
        }
        const res = await downloadSeasonPlanPdf({
          rows: loaded.rows,
          teamName: ourTeamName || 'Mannschaft',
          ageGroup: meta.ageGroup || ageGroup,
          seasonName: meta.seasonName || seasonName,
          seasonPhase: meta.seasonPhase ?? seasonPhase,
          teamLogoUrl: getOurTeamLogoUrl(),
          opponentLogoUrls,
          includeTrainings: false,
        });
        if (res.error) setPdfError(res.error);
      } catch (err) {
        setPdfError(err instanceof Error ? err.message : String(err));
      } finally {
        setPdfBusy(null);
      }
    })();
  };

  return (
    <PageShell
      background="more"
      className="page team-schedule min-h-[60vh] w-full max-w-none min-w-0 overflow-x-hidden px-3 py-6 sm:px-4 md:px-0"
      contentClassName="mx-auto w-full min-w-0 max-w-none space-y-4 md:max-w-3xl lg:max-w-4xl"
    >
      <Link
        to="/app/home"
        className="inline-flex items-center gap-1 text-sm font-medium text-white/65 hover:text-white"
      >
        <ChevronLeft className="h-4 w-4" aria-hidden />
        Zurück
      </Link>

      <SectionTitle subtitle={subtitle || undefined}>{headerTitle}</SectionTitle>

      {!selectedTeamSeasonId ? (
        <p className="text-sm text-white/55">Bitte Team / Saison wählen.</p>
      ) : null}

      {error ? (
        <p className="rounded-xl border border-red-500/30 bg-red-950/40 px-3 py-2 text-sm text-red-100">
          {error}
        </p>
      ) : null}
      {pdfError ? (
        <p className="rounded-xl border border-amber-500/30 bg-amber-950/40 px-3 py-2 text-sm text-amber-100">
          {pdfError}
        </p>
      ) : null}

      <div className="grid gap-2 sm:grid-cols-2">
        <PremiumButton
          type="button"
          variant="subtle"
          disabled={!selectedTeamSeasonId || pdfBusy !== null}
          onClick={onDownloadChampionshipPdf}
          className="inline-flex min-h-[44px] items-center justify-center gap-2"
        >
          <FileText className="h-4 w-4" aria-hidden />
          {pdfBusy === 'champ' ? 'PDF…' : 'Meisterschaftsspielplan PDF'}
        </PremiumButton>
        <PremiumButton
          type="button"
          variant="subtle"
          disabled={!selectedTeamSeasonId || pdfBusy !== null}
          onClick={onDownloadSeasonPlanPdf}
          className="inline-flex min-h-[44px] items-center justify-center gap-2"
        >
          <FileText className="h-4 w-4" aria-hidden />
          {pdfBusy === 'season' ? 'PDF…' : 'Saisonplan PDF'}
        </PremiumButton>
      </div>

      {showManage ? (
        <Link to="/app/mehr/championship" className={cn(dsPanelRowClass(), 'no-underline')}>
          <span className="flex items-center gap-2">
            <Settings2 className="h-5 w-5 text-red-400" aria-hidden />
            <span>Meisterschaft verwalten</span>
          </span>
        </Link>
      ) : null}

      <section className="space-y-2" aria-label="Meisterschaft">
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/55">
          Meisterschaft
        </p>
        {loading ? <p className="text-sm text-white/55">Lade Spielplan…</p> : null}
        {!loading && published.length === 0 ? (
          <p className="text-sm text-white/55">Noch keine veröffentlichten Meisterschaftsspiele.</p>
        ) : null}
        {published.map((f) => {
          const kick = kickoffLabel(f);
          const isOpen = kick === 'offen';
          const logo = logoUrlFor(f.opponent, f.opponent_logo_url);
          return (
            <PremiumCard key={f.id} variant="subtle" showAmbientGlow={false} className="space-y-1.5 !p-3">
              <div className="flex items-start gap-3">
                <img
                  src={logo || PLACEHOLDER_LOGO}
                  alt=""
                  className="h-10 w-10 shrink-0 rounded-lg object-contain bg-black/30"
                />
                <div className="min-w-0 flex-1">
                  <p className="text-sm text-white/75">
                    {formatPdfDateWithWeekday(f.starts_at)}
                    {' · '}
                    <span className={isOpen ? 'font-bold text-red-400' : 'font-semibold text-white'}>
                      {kick}
                    </span>
                  </p>
                  <p className="mt-0.5 text-[15px] font-semibold text-white">
                    {encounterLine(f, ourTeamName)}
                  </p>
                  {f.location ? (
                    <p className="mt-0.5 truncate text-xs text-white/50">{f.location}</p>
                  ) : null}
                </div>
              </div>
            </PremiumCard>
          );
        })}
      </section>

      {!loading && otherRows.length > 0 ? (
        <section className="space-y-2" aria-label="Weitere Saisontermine">
          <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/55">
            Weitere Saisontermine
          </p>
          {otherRows.map((row) => {
            const kick =
              !row.starts_at || isChampionshipKickoffTimeOpen(row.starts_at, null)
                ? 'offen'
                : utcIsoToViennaTimeHHmm(row.starts_at) || 'offen';
            return (
              <PremiumCard key={row.id} variant="subtle" showAmbientGlow={false} className="space-y-1 !p-3">
                <p className="text-[10px] font-bold uppercase tracking-wide text-white/45">
                  {row.kind === 'tournament' ? 'Turnier' : 'Vorbereitung'}
                </p>
                <p className="text-sm text-white/75">
                  {formatPdfDateWithWeekday(row.starts_at)}
                  {' · '}
                  <span className={kick === 'offen' ? 'font-bold text-red-400' : undefined}>
                    {kick}
                  </span>
                </p>
                <p className="text-[15px] font-semibold text-white">{otherEventTitle(row, ourTeamName)}</p>
                {row.location ? (
                  <p className="truncate text-xs text-white/50">{row.location}</p>
                ) : null}
              </PremiumCard>
            );
          })}
        </section>
      ) : null}
    </PageShell>
  );
};
