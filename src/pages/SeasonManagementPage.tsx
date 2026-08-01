import React, { useCallback, useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { ArrowRightCircle, CalendarRange, ChevronLeft, Lock, Upload } from 'lucide-react';
import { useSession } from '../auth/useSession';
import { SeasonTransitionWizard } from '../components/season/SeasonTransitionWizard';
import { canPrepareNextSeason, SEASON_SOFT_LOCK_MESSAGE } from '../lib/seasonLifecycle';
import {
  fetchSeasonManagementSnapshot,
  mapPrepareDraftError,
  type SeasonCardModel,
  type SeasonManagementSnapshot,
} from '../lib/seasonManagementData';
import {
  archiveTeamSeason,
  completeSeasonTransition,
  DEFAULT_SEASON_TRANSFER_OPTIONS,
  prepareSeasonDraftWithOptions,
} from '../lib/seasonTransition';
import { dsPanelRowClass } from '../lib/premiumDesignSystem';
import { PageShell, PremiumButton, PremiumCard, SectionTitle } from '../ui';
import { cn } from '../ui/lib/cn';

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
  variant: 'active' | 'draft' | 'archived';
}) {
  return (
    <PremiumCard
      variant="subtle"
      showAmbientGlow={variant === 'active'}
      className={cn(
        'space-y-3',
        variant === 'active' && 'border-emerald-900/35',
        variant === 'draft' && 'border-amber-900/30',
        variant === 'archived' && 'border-white/10',
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

const ARCHIVE_ONLY_CONFIRM =
  'Möchtest du diese Saison wirklich abschließen?\n\nAlle bisherigen Spiele, Trainings und Statistiken bleiben erhalten. Neue Termine und Änderungen sind danach in dieser Saison nicht mehr möglich.';

const FINALIZE_CONFIRM =
  'Saisonwechsel jetzt abschließen?\n\nDie aktuelle Saison wird abgeschlossen. Die vorbereitete Saison wird aktiv — du arbeitest danach in der neuen Saison weiter.\n\nHistorie der alten Saison bleibt lesbar.';

export const SeasonManagementPage: React.FC = () => {
  const { effectiveRole, backendRole, selectedTeamSeasonId, setSelectedTeamSeasonId } = useSession();
  const allowed = canAccessSeasonManagement(effectiveRole, backendRole);

  const [snapshot, setSnapshot] = useState<SeasonManagementSnapshot | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [showOefbHint, setShowOefbHint] = useState(false);
  const [busy, setBusy] = useState(false);
  const [showPrepareWizard, setShowPrepareWizard] = useState(false);

  const reload = useCallback(async () => {
    if (!selectedTeamSeasonId) {
      setSnapshot(null);
      setLoadError('Keine Mannschaft gewählt. Bitte oben eine Saison auswählen.');
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
  const activeId = snapshot?.active?.id ?? null;
  const draftId = snapshot?.draft?.id ?? null;
  const sourceCard = snapshot?.active ?? null;
  const selectedIsArchived = snapshot?.active == null && Boolean(selectedTeamSeasonId);

  const onArchiveOnly = async () => {
    if (!activeId) return;
    setActionError(null);
    setSuccessMsg(null);
    setShowOefbHint(false);
    if (!window.confirm(ARCHIVE_ONLY_CONFIRM)) return;
    setBusy(true);
    const res = await archiveTeamSeason(activeId);
    setBusy(false);
    if (!res.ok) {
      setActionError(res.message);
      return;
    }
    setSuccessMsg('Saison wurde abgeschlossen.');
    setShowPrepareWizard(false);
    await reload();
  };

  const onFinalizeSeasonSwitch = async () => {
    if (!activeId || !draftId) return;
    setActionError(null);
    setSuccessMsg(null);
    setShowOefbHint(false);
    if (!window.confirm(FINALIZE_CONFIRM)) return;

    setBusy(true);
    const res = await completeSeasonTransition({
      sourceTeamSeasonId: activeId,
      existingDraftTeamSeasonId: draftId,
      options: {
        ...DEFAULT_SEASON_TRANSFER_OPTIONS,
        // Join-Upsert ist idempotent — sichert Kader/Staff nochmals ab
        transferPlayers: true,
        selectedPlayerIds: null,
      },
      confirmArchiveSource: true,
    });
    setBusy(false);

    if (!res.ok) {
      setActionError(res.message);
      return;
    }

    setSelectedTeamSeasonId(res.newTeamSeasonId);
    setSuccessMsg('Saisonwechsel abgeschlossen. Du bist jetzt in der neuen Saison.');
    setShowOefbHint(true);
    setShowPrepareWizard(false);
    await reload();
  };

  const onPrepareConfirm = async (result: {
    seasonName: string;
    ageGroup: string;
    options: import('../lib/seasonTransition').SeasonTransferOptions;
    confirmArchiveSource: boolean;
  }) => {
    if (!activeId) return;
    setActionError(null);
    setSuccessMsg(null);
    setShowOefbHint(false);
    setBusy(true);

    const res = await prepareSeasonDraftWithOptions({
      sourceTeamSeasonId: activeId,
      seasonName: result.seasonName,
      ageGroup: result.ageGroup,
      options: result.options,
    });
    setBusy(false);
    if (!res.ok) {
      console.error('[SeasonManagement] prepare failed', res);
      setActionError(mapPrepareDraftError(res.code, res.message));
      return;
    }
    if (res.transferError) {
      setActionError(
        `Neue Saison vorbereitet, aber Übernahme teilweise fehlgeschlagen: ${res.transferError}`,
      );
    } else {
      setSuccessMsg(
        'Neue Saison vorbereitet. Die aktuelle Saison bleibt aktiv — du kannst den Wechsel später abschließen.',
      );
    }
    setShowPrepareWizard(false);
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

      <SectionTitle subtitle="Bereite die nächste Saison vor oder schließe die aktuelle ab.">
        Saisonverwaltung
      </SectionTitle>

      {loading ? <p className="text-sm text-white/55">Lade Saisons…</p> : null}

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
              <p className="flex items-start gap-2 text-sm text-white/70">
                <Lock className="mt-0.5 h-4 w-4 shrink-0 text-white/45" aria-hidden />
                {selectedIsArchived
                  ? SEASON_SOFT_LOCK_MESSAGE
                  : 'Keine aktive Saison für dieses Team gefunden.'}
              </p>
            </PremiumCard>
          )}

          {snapshot.draft ? <SeasonCard model={snapshot.draft} variant="draft" /> : null}

          {successMsg ? (
            <div className="space-y-2" role="status">
              <p className="rounded-lg border border-emerald-500/35 bg-emerald-950/40 px-3 py-2 text-sm text-emerald-100">
                {successMsg}
              </p>
              {showOefbHint ? (
                <div className="space-y-2 rounded-lg border border-white/10 bg-white/[0.03] px-3 py-3">
                  <p className="text-sm text-white/70">Nächster Schritt</p>
                  <PremiumButton
                    type="button"
                    variant="subtle"
                    fullWidth
                    disabled
                    className="cursor-not-allowed gap-2 opacity-60"
                    title="Demnächst verfügbar"
                  >
                    <Upload className="h-4 w-4 shrink-0 opacity-80" aria-hidden />
                    ÖFB-Spielplan importieren
                    <span className="ml-auto text-[10px] font-bold uppercase tracking-wider text-amber-200/90">
                      Demnächst
                    </span>
                  </PremiumButton>
                  <p className="text-[11px] text-white/40">
                    Der Import kommt in einem späteren Schritt. Bis dahin kannst du Termine manuell
                    anlegen.
                  </p>
                </div>
              ) : null}
            </div>
          ) : null}

          {actionError ? (
            <p
              className="rounded-lg border border-red-500/35 bg-red-950/40 px-3 py-2 text-sm text-red-200"
              role="alert"
            >
              {actionError}
            </p>
          ) : null}

          {showPrepareWizard && sourceCard ? (
            <SeasonTransitionWizard
              mode="prepare"
              sourceTeamSeasonId={sourceCard.id}
              sourceSeasonName={sourceCard.seasonName}
              sourceAgeGroup={sourceCard.ageGroup}
              sourceTeamName={sourceCard.teamName}
              busy={busy}
              onCancel={() => setShowPrepareWizard(false)}
              onConfirm={(r) => void onPrepareConfirm(r)}
            />
          ) : (
            <PremiumCard variant="subtle" showAmbientGlow={false} className="space-y-4 pt-1">
              {hasDraft && snapshot.draft ? (
                <div className="space-y-2">
                  <p className="text-sm text-white/60">
                    Die neue Saison ist vorbereitet. Wenn alles passt, schließt du den Wechsel in einem
                    Schritt ab.
                  </p>
                  <PremiumButton
                    type="button"
                    variant="default"
                    fullWidth
                    disabled={!snapshot.active || busy}
                    onClick={() => void onFinalizeSeasonSwitch()}
                    className="gap-2"
                  >
                    <ArrowRightCircle className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
                    Saisonwechsel abschließen
                  </PremiumButton>
                </div>
              ) : (
                <div className="space-y-2">
                  <PremiumButton
                    type="button"
                    variant="default"
                    fullWidth
                    disabled={!snapshot.active || busy}
                    onClick={() => setShowPrepareWizard(true)}
                    className="gap-2"
                  >
                    <CalendarRange className="h-4 w-4 shrink-0 opacity-90" aria-hidden />
                    Neue Saison vorbereiten
                  </PremiumButton>
                  <p className="text-[12px] leading-snug text-white/45">
                    Bereite die nächste Saison in Ruhe vor. Deine aktuelle Saison bleibt aktiv, bis du
                    den Wechsel bestätigst.
                  </p>
                </div>
              )}

              <div className="space-y-2 border-t border-white/10 pt-3">
                <PremiumButton
                  type="button"
                  variant="subtle"
                  fullWidth
                  disabled={!snapshot.active || busy}
                  onClick={() => void onArchiveOnly()}
                  className="gap-2 text-white/70"
                >
                  <Lock className="h-4 w-4 shrink-0 opacity-80" aria-hidden />
                  Saison nur abschließen
                </PremiumButton>
                <p className="text-[12px] leading-snug text-white/40">
                  Nur verwenden, wenn keine neue Saison vorbereitet werden soll.
                </p>
              </div>
            </PremiumCard>
          )}
        </div>
      ) : null}

      {!loading && !loadError && !snapshot?.active && !snapshot?.draft ? (
        <p className="text-sm text-white/50">
          Wähle oben eine Mannschaft, um die Saisonverwaltung zu nutzen.
        </p>
      ) : null}
    </PageShell>
  );
};
