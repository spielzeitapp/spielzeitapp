import React, { useEffect, useMemo, useState } from 'react';
import {
  computeNextAgeGroup,
  computeNextSeasonName,
  resolveCurrentAgeGroup,
} from '../../lib/seasonLifecycle';
import {
  DEFAULT_SEASON_TRANSFER_OPTIONS,
  describeTransferForConfirm,
  isTeamSeasonPlayersAvailable,
  listTransferCandidatePlayers,
  type SeasonTransferOptions,
  type TransferCandidatePlayer,
} from '../../lib/seasonTransition';
import { PremiumButton, PremiumCard } from '../../ui';
import { cn } from '../../ui/lib/cn';

export type SeasonTransitionMode = 'prepare' | 'close_and_create';

type Props = {
  mode: SeasonTransitionMode;
  sourceTeamSeasonId: string;
  sourceSeasonName: string | null;
  sourceAgeGroup: string | null;
  sourceTeamName: string | null;
  busy?: boolean;
  onCancel: () => void;
  onConfirm: (result: {
    seasonName: string;
    ageGroup: string;
    options: SeasonTransferOptions;
    confirmArchiveSource: boolean;
  }) => void;
};

const AGE_PRESETS = ['U8', 'U9', 'U10', 'U11', 'U12', 'U13', 'U14', 'U15', 'U16', 'U17', 'U18'];

export function SeasonTransitionWizard({
  mode,
  sourceTeamSeasonId,
  sourceSeasonName,
  sourceAgeGroup,
  sourceTeamName,
  busy = false,
  onCancel,
  onConfirm,
}: Props) {
  const defaultSeason = useMemo(
    () => (sourceSeasonName?.trim() ? computeNextSeasonName(sourceSeasonName.trim()) : ''),
    [sourceSeasonName],
  );
  const defaultAge = useMemo(() => {
    const current =
      sourceAgeGroup?.trim() ||
      resolveCurrentAgeGroup({ teamName: sourceTeamName, ageGroup: sourceAgeGroup }) ||
      '';
    return current ? computeNextAgeGroup(current) : '';
  }, [sourceAgeGroup, sourceTeamName]);

  const [step, setStep] = useState(1);
  const [seasonName, setSeasonName] = useState(defaultSeason);
  const [ageGroup, setAgeGroup] = useState(defaultAge);
  const [joinAvailable, setJoinAvailable] = useState<boolean | null>(null);
  const [candidates, setCandidates] = useState<TransferCandidatePlayer[]>([]);
  const [candidatesError, setCandidatesError] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [options, setOptions] = useState<SeasonTransferOptions>({
    ...DEFAULT_SEASON_TRANSFER_OPTIONS,
    transferPlayers: false,
  });
  const [confirmArchive, setConfirmArchive] = useState(false);

  useEffect(() => {
    let alive = true;
    void (async () => {
      const available = await isTeamSeasonPlayersAvailable();
      if (!alive) return;
      setJoinAvailable(available);

      const canTransferPlayers = mode === 'close_and_create' && available;
      setOptions((prev) => ({
        ...prev,
        transferPlayers: canTransferPlayers,
      }));

      if (mode !== 'close_and_create') return;

      const { data, error } = await listTransferCandidatePlayers(sourceTeamSeasonId);
      if (!alive) return;
      if (error) {
        setCandidatesError(error);
        setCandidates([]);
        setSelectedIds(new Set());
        return;
      }
      setCandidatesError(null);
      setCandidates(data);
      setSelectedIds(new Set(data.map((p) => p.id)));
    })();
    return () => {
      alive = false;
    };
  }, [mode, sourceTeamSeasonId]);

  const totalSteps = mode === 'close_and_create' ? 4 : 3;
  const archiveSource = mode === 'close_and_create';
  const playerTransferEnabled = mode === 'close_and_create' && joinAvailable === true;

  const toggle = (key: keyof SeasonTransferOptions) => {
    if (key === 'transferPlayers') {
      if (!playerTransferEnabled) return;
      setOptions((prev) => ({ ...prev, transferPlayers: !prev.transferPlayers }));
      return;
    }
    if (key === 'selectedPlayerIds') return;
    setOptions((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const togglePlayer = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllPlayers = () => setSelectedIds(new Set(candidates.map((p) => p.id)));
  const selectNoPlayers = () => setSelectedIds(new Set());

  const canNext =
    step === 1
      ? seasonName.trim().length > 0
      : step === 2
        ? ageGroup.trim().length > 0
        : step === 3
          ? true
          : confirmArchive;

  return (
    <PremiumCard variant="subtle" showAmbientGlow={false} className="space-y-4">
      <div>
        <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/45">
          Schritt {step} von {totalSteps}
        </p>
        <h3 className="mt-1 text-[15px] font-bold text-white">
          {mode === 'prepare' ? 'Neue Saison vorbereiten' : 'Saison abschließen und neue erstellen'}
        </h3>
      </div>

      {step === 1 ? (
        <div className="space-y-2">
          <label className="block text-sm text-white/70" htmlFor="season-name">
            Neue Saison
          </label>
          <input
            id="season-name"
            value={seasonName}
            onChange={(e) => setSeasonName(e.target.value)}
            placeholder="z. B. 2026/27"
            className="w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2.5 text-sm text-white outline-none focus:border-white/35"
          />
          <p className="text-[12px] text-white/45">Vorschlag aus aktueller Saison — frei änderbar.</p>
        </div>
      ) : null}

      {step === 2 ? (
        <div className="space-y-2">
          <label className="block text-sm text-white/70" htmlFor="age-group">
            Neue Altersklasse
          </label>
          <input
            id="age-group"
            value={ageGroup}
            onChange={(e) => setAgeGroup(e.target.value)}
            placeholder="z. B. U11"
            className="w-full rounded-xl border border-white/15 bg-black/40 px-3 py-2.5 text-sm text-white outline-none focus:border-white/35"
          />
          <div className="flex flex-wrap gap-1.5">
            {AGE_PRESETS.map((ag) => (
              <button
                key={ag}
                type="button"
                onClick={() => setAgeGroup(ag)}
                className={cn(
                  'rounded-full border px-2.5 py-1 text-[11px] font-semibold',
                  ageGroup === ag
                    ? 'border-emerald-400/50 bg-emerald-950/40 text-emerald-100'
                    : 'border-white/15 bg-white/5 text-white/70',
                )}
              >
                {ag}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {step === 3 ? (
        <div className="space-y-3">
          <p className="text-sm text-white/70">Aus der bestehenden Mannschaft übernehmen</p>
          {(
            [
              ['transferPlayers', 'Spieler übernehmen'],
              ['copyStaff', 'Trainer & Betreuer übernehmen'],
              ['copyTeamPhoto', 'Mannschaftsfoto'],
              ['copyNotificationSettings', 'Erinnerungseinstellungen'],
              ['copyAliases', 'Team-Aliase'],
            ] as const
          ).map(([key, label]) => {
            const disabled =
              (mode === 'prepare' && key === 'transferPlayers') ||
              (key === 'transferPlayers' && !playerTransferEnabled);
            return (
              <label
                key={key}
                className={cn(
                  'flex items-start gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2.5 text-sm text-white/85',
                  disabled && 'opacity-50',
                )}
              >
                <input
                  type="checkbox"
                  className="mt-0.5"
                  checked={options[key]}
                  disabled={disabled}
                  onChange={() => toggle(key)}
                />
                <span>
                  {label}
                  {key === 'transferPlayers' && mode === 'prepare' ? (
                    <span className="mt-0.5 block text-[11px] text-amber-200/80">
                      Beim Vorbereiten bleiben die Spieler in der aktuellen Saison.
                    </span>
                  ) : null}
                  {key === 'transferPlayers' && mode === 'close_and_create' && joinAvailable === false ? (
                    <span className="mt-0.5 block text-[11px] text-amber-200/80">
                      Spielerübernahme ist hier noch nicht freigeschaltet. Bitte Administrator
                      kontaktieren.
                    </span>
                  ) : null}
                  {key === 'transferPlayers' && playerTransferEnabled ? (
                    <span className="mt-0.5 block text-[11px] text-white/45">
                      Spieler behalten ihr Profil. Der alte Kader bleibt in der abgeschlossenen Saison
                      sichtbar. Keine Stats werden kopiert.
                    </span>
                  ) : null}
                </span>
              </label>
            );
          })}

          {playerTransferEnabled && options.transferPlayers ? (
            <div className="space-y-2 rounded-xl border border-white/10 bg-black/25 px-3 py-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-sm font-semibold text-white/85">
                  Spieler auswählen ({selectedIds.size}/{candidates.length})
                </p>
                <div className="flex gap-2">
                  <button
                    type="button"
                    className="text-[11px] font-semibold text-emerald-200/90 underline-offset-2 hover:underline"
                    onClick={selectAllPlayers}
                  >
                    Alle
                  </button>
                  <button
                    type="button"
                    className="text-[11px] font-semibold text-white/55 underline-offset-2 hover:underline"
                    onClick={selectNoPlayers}
                  >
                    Keine
                  </button>
                </div>
              </div>
              {candidatesError ? (
                <p className="text-[12px] text-red-300" role="alert">
                  {candidatesError}
                </p>
              ) : null}
              <ul className="max-h-56 space-y-1 overflow-y-auto pr-1">
                {candidates.map((p) => (
                  <li key={p.id}>
                    <label className="flex items-center gap-2 rounded-lg px-1.5 py-1.5 text-sm text-white/85 hover:bg-white/[0.04]">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(p.id)}
                        onChange={() => togglePlayer(p.id)}
                      />
                      <span className="min-w-0 flex-1 truncate">
                        {p.jersey_number != null ? (
                          <span className="mr-1.5 tabular-nums text-white/45">#{p.jersey_number}</span>
                        ) : null}
                        {p.display_name}
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
              {candidates.length === 0 && !candidatesError ? (
                <p className="text-[12px] text-white/45">Kein aktiver Kader in der Quell-Saison.</p>
              ) : null}
            </div>
          ) : null}

          <p className="text-[11px] text-white/40">
            Nicht übernommen: Spiele, Trainings, Turniere, Ergebnisse und Live-Daten.
          </p>
        </div>
      ) : null}

      {step === 4 && mode === 'close_and_create' ? (
        <div className="space-y-3">
          <p className="text-sm leading-snug text-white/75">
            {describeTransferForConfirm(
              {
                ...options,
                selectedPlayerIds: options.transferPlayers ? [...selectedIds] : [],
              },
              true,
            )}
          </p>
          <label className="flex items-start gap-2 rounded-xl border border-amber-500/30 bg-amber-950/25 px-3 py-2.5 text-sm text-amber-50">
            <input
              type="checkbox"
              className="mt-0.5"
              checked={confirmArchive}
              onChange={(e) => setConfirmArchive(e.target.checked)}
            />
            <span>
              Ich bestätige: Die aktuelle Saison wird abgeschlossen (Soft-Lock). Historie bleibt lesbar.
            </span>
          </label>
        </div>
      ) : null}

      <div className="flex flex-col gap-2 sm:flex-row">
        <PremiumButton
          type="button"
          variant="interactive"
          fullWidth
          disabled={busy}
          onClick={() => {
            if (step <= 1) onCancel();
            else setStep((s) => s - 1);
          }}
        >
          {step <= 1 ? 'Abbrechen' : 'Zurück'}
        </PremiumButton>
        {step < totalSteps ? (
          <PremiumButton
            type="button"
            variant="default"
            fullWidth
            disabled={!canNext || busy}
            onClick={() => setStep((s) => s + 1)}
          >
            Weiter
          </PremiumButton>
        ) : (
          <PremiumButton
            type="button"
            variant="default"
            fullWidth
            disabled={!canNext || busy}
            onClick={() =>
              onConfirm({
                seasonName: seasonName.trim(),
                ageGroup: ageGroup.trim(),
                options: {
                  ...options,
                  transferPlayers: mode === 'close_and_create' ? options.transferPlayers : false,
                  selectedPlayerIds:
                    mode === 'close_and_create' && options.transferPlayers
                      ? [...selectedIds]
                      : [],
                },
                confirmArchiveSource: archiveSource && confirmArchive,
              })
            }
          >
            {busy
              ? 'Wird ausgeführt…'
              : mode === 'prepare'
                ? 'Neue Saison vorbereiten'
                : 'Saison abschließen und neue erstellen'}
          </PremiumButton>
        )}
      </div>
    </PremiumCard>
  );
}
