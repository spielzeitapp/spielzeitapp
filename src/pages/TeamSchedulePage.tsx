/**
 * Read-only Team-Spielplan für Eltern, Trainer, Co-Trainer, Admin.
 * Filter: Heim/Auswärts + Spielort; gefilterter Saisonplan-PDF.
 * Nur veröffentlichte Meisterschaft + Vorbereitung + Turniere.
 */
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ChevronLeft, FileText, RotateCcw, Settings2 } from 'lucide-react';
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
import {
  collectUsedVenueIds,
  countScheduleHomeAway,
  DEFAULT_SCHEDULE_PLAN_FILTER,
  filterSchedulePlanRows,
  isScheduleFilterActive,
  loadScheduleVenueOptions,
  parseScheduleHomeAway,
  resolveSeasonPlanPdfTitleKind,
  slugifyScheduleToken,
  type ScheduleHomeAwayFilter,
  type SchedulePlanFilterState,
  type ScheduleVenueOption,
} from '../lib/schedulePlanFilters';
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

function kickoffLabelFixture(f: ChampionshipFixture): string {
  if (!f.starts_at || isChampionshipKickoffTimeOpen(f.starts_at, f.fixture_status)) return 'offen';
  return utcIsoToViennaTimeHHmm(f.starts_at) || 'offen';
}

function kickoffLabelRow(row: SeasonPlanRow): string {
  if (!row.starts_at) return 'offen';
  if (row.kind === 'championship') {
    if (isChampionshipKickoffTimeOpen(row.starts_at, 'published')) return 'offen';
  } else if (isChampionshipKickoffTimeOpen(row.starts_at, null)) {
    return 'offen';
  }
  return utcIsoToViennaTimeHHmm(row.starts_at) || 'offen';
}

function encounterLine(f: ChampionshipFixture, ourTeamName: string): string {
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

const chipBase =
  'inline-flex min-h-[44px] shrink-0 items-center justify-center rounded-full border px-3.5 text-[13px] font-semibold transition-colors touch-manipulation';
const chipIdle = 'border-white/12 bg-white/[0.04] text-white/75 hover:bg-white/[0.08]';
const chipActive = 'border-red-400/45 bg-red-950/55 text-white';

export const TeamSchedulePage: React.FC = () => {
  const {
    selectedTeamSeasonId,
    effectiveRole,
    backendRole,
  } = useSession();
  const showManage = canManageChampionship(effectiveRole, backendRole);
  const [searchParams, setSearchParams] = useSearchParams();

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fixtures, setFixtures] = useState<ChampionshipFixture[]>([]);
  const [seasonRows, setSeasonRows] = useState<SeasonPlanRow[]>([]);
  const [venueOptions, setVenueOptions] = useState<ScheduleVenueOption[]>([]);
  const [ageGroup, setAgeGroup] = useState<string | null>(null);
  const [seasonName, setSeasonName] = useState<string | null>(null);
  const [seasonPhase, setSeasonPhase] = useState<SeasonPhase | null>(null);
  const [clubId, setClubId] = useState<string | null>(null);
  const [catalogLogoMap, setCatalogLogoMap] = useState<Map<string, string>>(new Map());
  const [pdfBusy, setPdfBusy] = useState<'champ' | 'season' | 'filtered' | null>(null);
  const [pdfError, setPdfError] = useState<string | null>(null);

  const ourTeamName = getOurTeamDisplayName();

  const filter: SchedulePlanFilterState = useMemo(() => {
    const homeAway = parseScheduleHomeAway(searchParams.get('homeAway'));
    const venueRaw = String(searchParams.get('venue') ?? '').trim();
    return {
      homeAway,
      venueId: venueRaw || null,
      eventType: 'all',
    };
  }, [searchParams]);

  const setFilter = useCallback(
    (patch: Partial<SchedulePlanFilterState>) => {
      const next: SchedulePlanFilterState = {
        homeAway: patch.homeAway ?? filter.homeAway,
        venueId: patch.venueId !== undefined ? patch.venueId : filter.venueId,
        eventType: patch.eventType ?? filter.eventType,
      };
      const sp = new URLSearchParams();
      if (next.homeAway !== 'all') sp.set('homeAway', next.homeAway);
      if (next.venueId) sp.set('venue', next.venueId);
      setSearchParams(sp, { replace: true });
    },
    [filter, setSearchParams],
  );

  const resetFilter = useCallback(() => {
    setSearchParams({}, { replace: true });
  }, [setSearchParams]);

  const reload = useCallback(async (teamSeasonId: string) => {
    setLoading(true);
    setError(null);
    const [meta, list, seasonLoaded, club] = await Promise.all([
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
    if (seasonLoaded.error) {
      setSeasonRows([]);
      if (!list.error) setError(seasonLoaded.error);
    } else {
      setSeasonRows(seasonLoaded.rows ?? []);
    }
    setClubId(club);

    const usedIds = collectUsedVenueIds(seasonLoaded.rows ?? []);
    const venues = await loadScheduleVenueOptions({
      venueIds: usedIds,
      rows: seasonLoaded.rows ?? [],
    });
    setVenueOptions(venues.options);

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
      setSeasonRows([]);
      setVenueOptions([]);
      return;
    }
    void reload(selectedTeamSeasonId);
  }, [selectedTeamSeasonId, reload]);

  const filteredRows = useMemo(
    () => filterSchedulePlanRows(seasonRows, filter),
    [seasonRows, filter],
  );

  const filteredChampionship = useMemo(
    () => filteredRows.filter((r) => r.kind === 'championship'),
    [filteredRows],
  );
  const filteredOther = useMemo(
    () => filteredRows.filter((r) => r.kind === 'tournament' || r.kind === 'friendly'),
    [filteredRows],
  );

  const homeAwayCounts = useMemo(() => countScheduleHomeAway(seasonRows), [seasonRows]);

  const filterActive = isScheduleFilterActive(filter);

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

  const selectedVenueName = useMemo(() => {
    if (!filter.venueId) return null;
    return venueOptions.find((v) => v.id === filter.venueId)?.name ?? null;
  }, [filter.venueId, venueOptions]);

  const logoUrlFor = (opponent: string | null | undefined, eventLogo: string | null | undefined) =>
    resolveDisplayOpponentLogo({
      opponent,
      eventLogoUrl: eventLogo,
      catalogLogoUrl: catalogLogoMap.get(normalizeOpponentKey(opponent)),
    });

  const buildOpponentLogoUrls = (rows: SeasonPlanRow[], logoMap: Map<string, string>) => {
    const opponentLogoUrls: Record<string, string> = {};
    for (const row of rows) {
      const name = (row.opponent || '').trim();
      if (!name || opponentLogoUrls[name]) continue;
      opponentLogoUrls[name] = resolveDisplayOpponentLogo({
        opponent: row.opponent,
        eventLogoUrl: row.opponent_logo_url,
        catalogLogoUrl: logoMap.get(normalizeOpponentKey(row.opponent)),
      });
    }
    return opponentLogoUrls;
  };

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

  const onDownloadSeasonPlanPdf = (mode: 'all' | 'filtered') => {
    if (!selectedTeamSeasonId) return;
    void (async () => {
      setPdfBusy(mode === 'filtered' ? 'filtered' : 'season');
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
        const activeFilter =
          mode === 'filtered' ? filter : DEFAULT_SCHEDULE_PLAN_FILTER;
        const rows = filterSchedulePlanRows(loaded.rows, activeFilter);
        const titleKind =
          mode === 'filtered'
            ? resolveSeasonPlanPdfTitleKind(activeFilter.homeAway)
            : 'saison';
        let venueSubtitle: string | null = null;
        let venueFilenameSlug: string | null = null;
        if (mode === 'filtered' && activeFilter.venueId) {
          const opt = venueOptions.find((v) => v.id === activeFilter.venueId);
          const name = opt?.name || selectedVenueName;
          if (name) {
            venueSubtitle = `Spielort: ${name}`;
            venueFilenameSlug = slugifyScheduleToken(name);
          }
        }
        const res = await downloadSeasonPlanPdf({
          rows,
          teamName: ourTeamName || 'Mannschaft',
          ageGroup: meta.ageGroup || ageGroup,
          seasonName: meta.seasonName || seasonName,
          seasonPhase: meta.seasonPhase ?? seasonPhase,
          teamLogoUrl: getOurTeamLogoUrl(),
          opponentLogoUrls: buildOpponentLogoUrls(rows, catalogLogoMap),
          includeTrainings: false,
          titleKind,
          venueSubtitle,
          venueFilenameSlug,
        });
        if (res.error) setPdfError(res.error);
      } catch (err) {
        setPdfError(err instanceof Error ? err.message : String(err));
      } finally {
        setPdfBusy(null);
      }
    })();
  };

  const emptyAfterFilter =
    !loading && filterActive && filteredChampionship.length === 0 && filteredOther.length === 0;

  const setHomeAway = (homeAway: ScheduleHomeAwayFilter) => setFilter({ homeAway });

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

      {selectedTeamSeasonId ? (
        <PremiumCard variant="subtle" showAmbientGlow={false} className="space-y-3 !p-3">
          <div className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/55">
              Spielart
            </p>
            <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-0.5 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              <button
                type="button"
                className={cn(chipBase, filter.homeAway === 'all' ? chipActive : chipIdle)}
                onClick={() => setHomeAway('all')}
              >
                Alle{homeAwayCounts.all > 0 ? ` ${homeAwayCounts.all}` : ''}
              </button>
              <button
                type="button"
                className={cn(chipBase, filter.homeAway === 'home' ? chipActive : chipIdle)}
                onClick={() => setHomeAway('home')}
              >
                Heimspiele{homeAwayCounts.home > 0 ? ` ${homeAwayCounts.home}` : ''}
              </button>
              <button
                type="button"
                className={cn(chipBase, filter.homeAway === 'away' ? chipActive : chipIdle)}
                onClick={() => setHomeAway('away')}
              >
                Auswärtsspiele{homeAwayCounts.away > 0 ? ` ${homeAwayCounts.away}` : ''}
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/55">
              Spielort
            </p>
            <label className="sr-only" htmlFor="spielplan-venue-filter">
              Spielort filtern
            </label>
            <select
              id="spielplan-venue-filter"
              className="min-h-[44px] w-full rounded-xl border border-white/12 bg-black/35 px-3 text-[14px] text-white focus:border-red-400/40 focus:outline-none"
              value={filter.venueId ?? ''}
              onChange={(e) => setFilter({ venueId: e.target.value.trim() || null })}
            >
              <option value="">Alle Spielorte</option>
              {venueOptions.map((v) => (
                <option key={v.id} value={v.id}>
                  {v.name}
                  {v.count > 0 ? ` (${v.count})` : ''}
                </option>
              ))}
            </select>
          </div>

          {filterActive ? (
            <button
              type="button"
              onClick={resetFilter}
              className="inline-flex min-h-[44px] items-center gap-1.5 text-[13px] font-semibold text-white/70 hover:text-white"
            >
              <RotateCcw className="h-3.5 w-3.5" aria-hidden />
              Filter zurücksetzen
            </button>
          ) : null}
        </PremiumCard>
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
          onClick={() => onDownloadSeasonPlanPdf('all')}
          className="inline-flex min-h-[44px] items-center justify-center gap-2"
        >
          <FileText className="h-4 w-4" aria-hidden />
          {pdfBusy === 'season' ? 'PDF…' : 'Saisonplan PDF'}
        </PremiumButton>
        <PremiumButton
          type="button"
          variant="subtle"
          disabled={!selectedTeamSeasonId || pdfBusy !== null}
          onClick={() => onDownloadSeasonPlanPdf('filtered')}
          className="inline-flex min-h-[44px] items-center justify-center gap-2 sm:col-span-2"
        >
          <FileText className="h-4 w-4" aria-hidden />
          {pdfBusy === 'filtered' ? 'PDF…' : 'PDF für aktuelle Auswahl'}
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

      {emptyAfterFilter ? (
        <PremiumCard variant="subtle" showAmbientGlow={false} className="space-y-3 !p-4 text-center">
          <p className="text-sm text-white/75">Keine Termine für diese Auswahl.</p>
          <PremiumButton
            type="button"
            variant="subtle"
            className="inline-flex min-h-[44px] items-center justify-center gap-2"
            onClick={resetFilter}
          >
            <RotateCcw className="h-4 w-4" aria-hidden />
            Filter zurücksetzen
          </PremiumButton>
        </PremiumCard>
      ) : (
        <>
          <section className="space-y-2" aria-label="Meisterschaft">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/55">
              Meisterschaft
            </p>
            {loading ? <p className="text-sm text-white/55">Lade Spielplan…</p> : null}
            {!loading && filteredChampionship.length === 0 ? (
              <p className="text-sm text-white/55">
                {filterActive
                  ? 'Keine Meisterschaftsspiele für diese Auswahl.'
                  : 'Noch keine veröffentlichten Meisterschaftsspiele.'}
              </p>
            ) : null}
            {filteredChampionship.map((row) => {
              const fixture = fixtures.find((f) => f.id === row.id);
              const kick = fixture ? kickoffLabelFixture(fixture) : kickoffLabelRow(row);
              const isOpen = kick === 'offen';
              const logo = logoUrlFor(row.opponent, row.opponent_logo_url);
              const title = fixture
                ? encounterLine(fixture, ourTeamName)
                : otherEventTitle(row, ourTeamName);
              return (
                <PremiumCard key={row.id} variant="subtle" showAmbientGlow={false} className="space-y-1.5 !p-3">
                  <div className="flex items-start gap-3">
                    <img
                      src={logo || PLACEHOLDER_LOGO}
                      alt=""
                      className="h-10 w-10 shrink-0 rounded-lg object-contain bg-black/30"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm text-white/75">
                        {formatPdfDateWithWeekday(row.starts_at)}
                        {' · '}
                        <span className={isOpen ? 'font-bold text-red-400' : 'font-semibold text-white'}>
                          {kick}
                        </span>
                      </p>
                      <p className="mt-0.5 text-[15px] font-semibold text-white">{title}</p>
                      {row.location ? (
                        <p className="mt-0.5 truncate text-xs text-white/50">{row.location}</p>
                      ) : null}
                    </div>
                  </div>
                </PremiumCard>
              );
            })}
          </section>

          {!loading && filteredOther.length > 0 ? (
            <section className="space-y-2" aria-label="Weitere Saisontermine">
              <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/55">
                Weitere Saisontermine
              </p>
              {filteredOther.map((row) => {
                const kick = kickoffLabelRow(row);
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
                    <p className="text-[15px] font-semibold text-white">
                      {otherEventTitle(row, ourTeamName)}
                    </p>
                    {row.location ? (
                      <p className="truncate text-xs text-white/50">{row.location}</p>
                    ) : null}
                  </PremiumCard>
                );
              })}
            </section>
          ) : null}
        </>
      )}
    </PageShell>
  );
};
