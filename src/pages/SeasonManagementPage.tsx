import React, { useCallback, useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { CalendarRange, ChevronLeft } from 'lucide-react';
import { useSession } from '../auth/useSession';
import { canPrepareNextSeason, getSeasonStatusLabel } from '../lib/seasonLifecycle';
import {
  fetchSeasonManagementSnapshot,
  mapPrepareDraftError,
  type SeasonCardModel,
  type SeasonManagementSnapshot,
} from '../lib/seasonManagementData';
import { prepareNextSeasonDraft } from '../lib/seasonPreparation';
import { dsPanelRowClass } from '../lib/premiumDesignSystem';
import { PageShell, PremiumButton, PremiumCard, SectionTitle } from '../ui';
import { cn } from '../ui/lib/cn';

const CONFIRM_MESSAGE =
  'Es wird nur ein Entwurf erstellt. Aktuelle Saison, Spieler, Termine und Spiele bleiben unverändert.\n\nFortfahren?';

function canAccessSeasonManagement(effectiveRole: string, backendRole: string): boolean {
  if ((backendRole ?? '').trim().toLowerCase() === 'admin') return true;
  if (canPrepareNextSeason(effectiveRole)) return true;
  if (canPrepareNextSeason(backendRole)) return true;
  const r = (effectiveRole ?? '').trim().toLowerCase();
  return r === 'trainer' || r === 'co_trainer' || r === 'head_coach';
}

function statusBadgeClass(status: string): string {
  if (status === 'active') {
    return 'border-emerald-500/45 bg-emerald-950/50 text-emerald-100 shadow-[0_0_12px_rgba(16,185,129,0.15)]';
  }
  if (status === 'draft') {
    return 'border-amber-500/40 bg-amber-950/45 text-amber-100 shadow-[0_0_12px_rgba(245,158,11,0.12)]';
  }
  return 'border-white/20 bg-white/5 text-white/75';
}

function SeasonCard({
  model,
  variant,
}: {
  model: SeasonCardModel;
  variant: 'active' | 'draft';
}) {
  return (
    <PremiumCard
      variant="subtle"
      showAmbientGlow={variant === 'active'}
      className={cn(
        'space-y-3',
        variant === 'active' && 'border-emerald-900/35',
        variant === 'draft' && 'border-amber-900/30',
      )}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <h2 className="text-[15px] font-bold tracking-tight text-white">{model.displayName}</h2>
        <span
          className={cn(
            'inline-flex shrink-0 rounded-full border px-2.5 py-0.5 text-[10px] font-black uppercase tracking-[0.12em]',
            statusBadgeClass(model.status),
          )}
        >
          {model.statusLabel}
        </span>
      </div>

      {model.ageGroup ? (
        <p className="text-sm text-white/65">
          Altersklasse: <span className="font-semibold text-white/90">{model.ageGroup}</span>
        </p>
      ) : null}

      {variant === 'draft' && model.preparedFromLabel ? (
        <p className="text-sm text-white/55">
          Vorbereitet aus:{' '}
          <span className="font-medium text-white/80">{model.preparedFromLabel}</span>
        </p>
      ) : null}

      {model.seasonName && !model.displayName.includes(model.seasonName) ? (
        <p className="text-[12px] text-white/45">Saison {model.seasonName}</p>
      ) : null}
    </PremiumCard>
  );
}

export const SeasonManagementPage: React.FC = () => {
  const { effectiveRole, backendRole, selectedTeamSeasonId } = useSession();
  const allowed = canAccessSeasonManagement(effectiveRole, backendRole);

  const [snapshot, setSnapshot] = useState<SeasonManagementSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [preparing, setPreparing] = useState(false);

  const reload = useCallback(async () => {
    if (!selectedTeamSeasonId) {
      setSnapshot(null);
      setLoadError('Keine Team-Saison gewählt.');
      setLoading(false);
      return;
    }
    setLoading(true);
    setLoadError(null);
    const { data, error } = await fetchSeasonManagementSnapshot(selectedTeamSeasonId);
    setSnapshot(data);
    setLoadError(error);
    setLoading(false);
  }, [selectedTeamSeasonId]);

  useEffect(() => {
    void reload();
  }, [reload]);

  if (!allowed) {
    return <Navigate to="/app/mehr" replace />;
  }

  const hasDraft = snapshot?.hasDraftForActive ?? Boolean(snapshot?.draft);
  const activeId = snapshot?.active?.id ?? selectedTeamSeasonId;

  const onPrepareDraft = async () => {
    if (!activeId || hasDraft) return;
    setActionError(null);
    setSuccessMsg(null);
    if (!window.confirm(CONFIRM_MESSAGE)) return;

    setPreparing(true);
    const res = await prepareNextSeasonDraft(activeId);
    setPreparing(false);

    if (!res.ok) {
      setActionError(mapPrepareDraftError(res.code, res.message));
      return;
    }

    setSuccessMsg('Neue Saison wurde als Entwurf vorbereitet.');
    await reload();
  };

  return (
    <PageShell
      background="more"
      className="min-h-[60vh] w-full px-3 py-6 sm:px-4 md:px-0"
      contentClassName="mx-auto w-full min-w-0 max-w-lg space-y-4"
    >
      <Link
        to="/app/mehr"
        className={cn(dsPanelRowClass(), '!min-h-[40px] !py-2 text-sm font-semibold text-white/85')}
      >
        <span className="flex items-center gap-2">
          <ChevronLeft className="h-4 w-4 text-white/50" aria-hidden />
          Zurück zu Mehr
        </span>
      </Link>

      <SectionTitle subtitle="Entwurf anlegen — ohne Daten zu kopieren">Saisonverwaltung</SectionTitle>

      {loading ? (
        <p className="text-sm text-white/55">Lade Saisons…</p>
      ) : null}

      {loadError ? (
        <PremiumCard variant="subtle" showAmbientGlow={false} className="border-red-500/30">
          <p className="text-sm text-red-300" role="alert">
            {loadError}
          </p>
        </PremiumCard>
      ) : null}

      {!loading && !loadError && snapshot ? (
        <div className="space-y-3">
          {snapshot.active ? (
            <SeasonCard model={snapshot.active} variant="active" />
          ) : (
            <PremiumCard variant="subtle" showAmbientGlow={false}>
              <p className="text-sm text-white/60">Keine aktive Saison für dieses Team gefunden.</p>
            </PremiumCard>
          )}

          {snapshot.draft ? (
            <SeasonCard model={snapshot.draft} variant="draft" />
          ) : null}

          {successMsg ? (
            <p
              className="rounded-lg border border-emerald-500/35 bg-emerald-950/40 px-3 py-2 text-sm text-emerald-100"
              role="status"
            >
              {successMsg}
            </p>
          ) : null}

          {actionError ? (
            <p
              className="rounded-lg border border-red-500/35 bg-red-950/40 px-3 py-2 text-sm text-red-200"
              role="alert"
            >
              {actionError}
            </p>
          ) : null}

          <PremiumCard variant="subtle" showAmbientGlow={false} className="space-y-3 pt-1">
            {hasDraft ? (
              <p className="text-sm text-amber-200/90">
                Entwurf bereits vorhanden
                {snapshot.draft ? ` (${getSeasonStatusLabel('draft')})` : ''}.
              </p>
            ) : (
              <p className="text-sm text-white/55">
                Legt nur eine neue <span className="text-white/75">team_season</span>-Zeile als Entwurf an.
                Spieler, Termine und Spiele werden nicht übernommen.
              </p>
            )}

            <PremiumButton
              type="button"
              variant="primary"
              fullWidth
              disabled={!snapshot.active || hasDraft || preparing}
              onClick={() => void onPrepareDraft()}
              className="gap-2"
            >
              <CalendarRange className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
              {preparing ? 'Wird vorbereitet…' : 'Neue Saison vorbereiten'}
            </PremiumButton>
          </PremiumCard>
        </div>
      ) : null}

      {!loading && !loadError && !snapshot?.active && !snapshot?.draft ? (
        <p className="text-sm text-white/50">Wähle unter Mehr eine Team-Saison, um die Verwaltung zu nutzen.</p>
      ) : null}
    </PageShell>
  );
};
