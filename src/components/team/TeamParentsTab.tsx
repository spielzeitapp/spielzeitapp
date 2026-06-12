import React, { useMemo, useState } from "react";
import { AppButton } from "../ui/AppButton";
import {
  GlassCard,
  PremiumCard,
  PremiumEmptyState,
  PremiumTab,
  PremiumTabTrack,
  SectionTitle,
} from "../../ui";
import {
  buildParentReminderWhatsAppText,
  buildPushReminderText,
  parentPrimaryLabel,
  parentPushDeviceLabel,
  parentShowEmailBelow,
  PARENT_LINKS_RPC_MIGRATION_HINT,
  type ParentLinkInfo,
  type PlayerParentLinkRow,
} from "../../hooks/useTeamPlayerParentLinks";

type ParentFilterId = "all" | "linked" | "open";

type TeamParentsTabProps = {
  teamSeasonId: string | null;
  tsLoading: boolean;
  rows: PlayerParentLinkRow[];
  loading: boolean;
  error: string | null;
  rpcMissing: boolean;
};

const CHIP_BASE =
  "inline-flex shrink-0 items-center justify-center rounded-full border font-semibold leading-none whitespace-nowrap";

function statusLabel(row: PlayerParentLinkRow): string {
  if ((row.status ?? "active") === "paused") return "Pausiert";
  return row.is_active !== false ? "Aktiv" : "Inaktiv";
}

function statusBadgeClass(row: PlayerParentLinkRow): string {
  if ((row.status ?? "active") === "paused") {
    return "border-amber-400/35 bg-amber-900/30 text-amber-200";
  }
  return "border-emerald-400/30 bg-emerald-900/25 text-emerald-200";
}

function ParentPushStatusBadges({ parent }: { parent: ParentLinkInfo }): React.ReactElement {
  const active = parent.push_active === true;
  const deviceLabel = active ? parentPushDeviceLabel(parent.push_device_count) : null;

  return (
    <div className="mt-2 flex min-w-0 flex-wrap items-center gap-1.5 sm:gap-2">
      <span
        className={[
          CHIP_BASE,
          "h-8 gap-1 px-3 text-[11px] text-emerald-100/90",
          "border-emerald-500/30 bg-[#0a1210]/90",
        ].join(" ")}
      >
        <span aria-hidden className="text-[10px] leading-none text-emerald-400/90">
          ✓
        </span>
        Verknüpft
      </span>
      {active ? (
        <span
          className={[
            CHIP_BASE,
            "h-8 gap-1 px-3 text-[11px] font-bold text-emerald-50",
            "border-emerald-400/45 bg-emerald-950/55",
            "shadow-[0_0_14px_rgba(52,211,153,0.2)]",
          ].join(" ")}
        >
          <span aria-hidden className="text-[12px] leading-none">
            🔔
          </span>
          Push aktiv
        </span>
      ) : (
        <span
          className={[
            CHIP_BASE,
            "h-7 gap-1 px-2.5 text-[10px] font-medium text-red-200/75",
            "border-red-900/50 bg-red-950/35",
          ].join(" ")}
        >
          <span aria-hidden className="text-[11px] leading-none opacity-80">
            🔕
          </span>
          Push aus
        </span>
      )}
      {deviceLabel ? (
        <span
          className={[
            CHIP_BASE,
            "h-8 gap-1 px-3 text-[11px] font-medium text-white/55",
            "border-white/12 bg-white/[0.05]",
          ].join(" ")}
        >
          <span aria-hidden className="text-[12px] leading-none">
            📱
          </span>
          {deviceLabel}
        </span>
      ) : null}
    </div>
  );
}

function PushReminderButton({
  onClick,
}: {
  onClick: () => void;
}): React.ReactElement {
  return (
    <button
      type="button"
      onClick={onClick}
      className={[
        "mt-2.5 inline-flex min-h-[44px] w-full touch-manipulation items-center justify-center gap-2",
        "rounded-xl border border-emerald-500/40 px-3 py-2",
        "bg-gradient-to-b from-emerald-700/95 via-emerald-900/95 to-[#071510]",
        "text-[13px] font-bold text-white",
        "shadow-[0_0_20px_rgba(16,185,129,0.22),inset_0_1px_0_rgba(255,255,255,0.1)]",
        "transition hover:border-emerald-400/55 hover:shadow-[0_0_26px_rgba(16,185,129,0.32)]",
        "active:scale-[0.99] sm:w-auto sm:min-w-[11.5rem]",
      ].join(" ")}
    >
      <span aria-hidden className="text-[14px] leading-none">
        🔔
      </span>
      Erinnerung senden
    </button>
  );
}

function ParentPushSummaryCard({
  pushActiveCount,
  pushInactiveCount,
}: {
  pushActiveCount: number;
  pushInactiveCount: number;
}): React.ReactElement | null {
  const total = pushActiveCount + pushInactiveCount;
  if (total === 0) return null;

  return (
    <GlassCard variant="subtle" showAmbientGlow={false} className="min-w-0 px-3 py-2.5 sm:px-4 sm:py-3">
      <p className="text-[11px] font-semibold uppercase tracking-wide text-white/45">Push-Status</p>
      <div className="mt-1.5 flex min-w-0 flex-col gap-1 sm:flex-row sm:flex-wrap sm:gap-x-4 sm:gap-y-1">
        <span className="inline-flex min-w-0 items-center gap-1.5 text-[13px] text-emerald-200/95">
          <span aria-hidden className="shrink-0 text-[10px] leading-none">
            🟢
          </span>
          <span>
            <span className="font-bold text-emerald-100">{pushActiveCount}</span>
            <span className="text-white/70">
              {" "}
              {pushActiveCount === 1 ? "Elternteil Push aktiv" : "Eltern Push aktiv"}
            </span>
          </span>
        </span>
        <span className="inline-flex min-w-0 items-center gap-1.5 text-[13px] text-red-200/80">
          <span aria-hidden className="shrink-0 text-[10px] leading-none">
            🔴
          </span>
          <span>
            <span className="font-bold text-red-100/90">{pushInactiveCount}</span>
            <span className="text-white/55">
              {" "}
              {pushInactiveCount === 1 ? "Elternteil ohne Push" : "Eltern ohne Push"}
            </span>
          </span>
        </span>
      </div>
    </GlassCard>
  );
}

export const TeamParentsTab: React.FC<TeamParentsTabProps> = ({
  teamSeasonId,
  tsLoading,
  rows,
  loading,
  error,
  rpcMissing,
}) => {
  const [filter, setFilter] = useState<ParentFilterId>("all");
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const linkedCount = useMemo(() => rows.filter((r) => r.parent_count > 0).length, [rows]);
  const openCount = useMemo(() => rows.filter((r) => r.parent_count === 0).length, [rows]);

  const pushSummary = useMemo(() => {
    let pushActiveCount = 0;
    let pushInactiveCount = 0;
    for (const row of rows) {
      for (const parent of row.parents) {
        if (parent.push_active === true) pushActiveCount += 1;
        else pushInactiveCount += 1;
      }
    }
    return { pushActiveCount, pushInactiveCount };
  }, [rows]);

  const filteredRows = useMemo(() => {
    if (filter === "linked") return rows.filter((r) => r.parent_count > 0);
    if (filter === "open") return rows.filter((r) => r.parent_count === 0);
    return rows;
  }, [rows, filter]);

  const showToast = (message: string) => {
    setToastMessage(message);
    window.setTimeout(() => setToastMessage(null), 2200);
  };

  const handleCopyReminder = async (playerName: string) => {
    const text = buildParentReminderWhatsAppText(playerName);
    try {
      await navigator.clipboard.writeText(text);
      showToast("WhatsApp-Text kopiert");
    } catch {
      showToast("WhatsApp-Text kopiert");
    }
  };

  const handlePushReminder = async (parent: ParentLinkInfo, playerName: string) => {
    const text = buildPushReminderText(parentPrimaryLabel(parent), playerName);
    try {
      if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
        const data: ShareData = { title: "SpielzeitApp · Benachrichtigungen", text };
        if (typeof navigator.canShare !== "function" || navigator.canShare(data)) {
          await navigator.share(data);
          return;
        }
      }
      await navigator.clipboard.writeText(text);
      showToast("Erinnerungstext kopiert");
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") return;
      try {
        await navigator.clipboard.writeText(text);
        showToast("Erinnerungstext kopiert");
      } catch {
        showToast("Teilen nicht möglich");
      }
    }
  };

  return (
    <>
      {toastMessage ? (
        <div
          className="pointer-events-none fixed left-1/2 top-[max(1rem,env(safe-area-inset-top,0px))] z-[1001] -translate-x-1/2"
          role="status"
          aria-live="polite"
        >
          <div className="rounded-full border border-white/12 bg-[rgba(8,8,12,0.94)] px-4 py-2 text-[13px] font-medium text-white/92 shadow-[0_10px_36px_rgba(0,0,0,0.55)] backdrop-blur-md">
            {toastMessage}
          </div>
        </div>
      ) : null}

      <PremiumCard variant="subtle" showAmbientGlow={false} className="min-w-0 overflow-hidden sm:p-5">
        <SectionTitle
          as="h2"
          className="[&>h2]:text-lg [&>h2]:font-semibold [&>h2]:tracking-tight [&>h2]:normal-case"
        >
          Eltern
        </SectionTitle>
        <p className="mt-1 text-[13px] text-white/60">
          Welche Spieler bereits mit Elternaccounts verknüpft sind.
        </p>

        {teamSeasonId == null && !tsLoading ? (
          <PremiumEmptyState variant="subtle" title="Bitte Team wählen." className="mt-3 py-6" />
        ) : loading ? (
          <p className="mt-4 text-[14px] text-white/70">Lade Eltern-Verknüpfungen…</p>
        ) : error ? (
          <p
            className="mt-4 rounded-lg border border-red-500/35 bg-red-950/40 px-3 py-2 text-[14px] text-red-300"
            role="alert"
          >
            {error}
          </p>
        ) : rows.length === 0 ? (
          <PremiumEmptyState variant="subtle" title="Noch keine Spieler angelegt." className="mt-4 py-6" />
        ) : (
          <div className="mt-4 min-w-0 space-y-3 sm:space-y-4">
            {rpcMissing ? (
              <p className="rounded-lg border border-amber-500/35 bg-amber-950/35 px-3 py-2 text-[13px] text-amber-100/95">
                {PARENT_LINKS_RPC_MIGRATION_HINT}
              </p>
            ) : null}

            <GlassCard variant="subtle" showAmbientGlow={false} className="min-w-0 px-3 py-3 sm:px-4">
              <div className="flex flex-wrap gap-x-4 gap-y-1 text-[14px] text-white/85">
                <span>
                  <span className="font-bold text-white">{rows.length}</span> Spieler
                </span>
                <span className="text-emerald-300">
                  <span className="font-bold">{linkedCount}</span> mit Eltern verknüpft
                </span>
                <span className="text-amber-300">
                  <span className="font-bold">{openCount}</span> noch offen
                </span>
              </div>
            </GlassCard>

            <PremiumTabTrack className="min-w-0">
              <PremiumTab
                kind="filter"
                active={filter === "all"}
                onClick={() => setFilter("all")}
                className="min-w-0 px-1.5 text-[10px] sm:text-[12px]"
              >
                Alle ({rows.length})
              </PremiumTab>
              <PremiumTab
                kind="filter"
                active={filter === "linked"}
                onClick={() => setFilter("linked")}
                className="min-w-0 px-1.5 text-[10px] sm:text-[12px]"
              >
                Verknüpft ({linkedCount})
              </PremiumTab>
              <PremiumTab
                kind="filter"
                active={filter === "open"}
                onClick={() => setFilter("open")}
                className="min-w-0 px-1.5 text-[10px] sm:text-[12px]"
              >
                Offen ({openCount})
              </PremiumTab>
            </PremiumTabTrack>

            <ParentPushSummaryCard
              pushActiveCount={pushSummary.pushActiveCount}
              pushInactiveCount={pushSummary.pushInactiveCount}
            />

            {filteredRows.length === 0 ? (
              <PremiumEmptyState
                variant="subtle"
                title={filter === "linked" ? "Keine verknüpften Spieler." : "Keine offenen Spieler."}
                className="py-6"
              />
            ) : (
              <ul className="min-w-0 space-y-2.5 pb-8">
                {filteredRows.map((row) => {
                  const linked = row.parent_count > 0;
                  return (
                    <li key={row.player_id} className="min-w-0">
                      <GlassCard
                        variant="subtle"
                        showAmbientGlow={false}
                        className={[
                          "min-w-0 px-3 py-3 sm:px-4",
                          linked
                            ? "border-emerald-500/20"
                            : "border-amber-500/25 bg-amber-950/10",
                        ].join(" ")}
                      >
                        <div className="flex flex-wrap items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-[16px] font-semibold leading-snug text-white">
                              {row.player_name}
                            </p>
                            <p className="mt-0.5 text-[13px] text-white/65">
                              {row.jersey_number != null ? `#${row.jersey_number}` : "—"}
                              <span className="mx-1.5 text-white/35">·</span>
                              <span
                                className={[
                                  "inline-flex rounded-full border px-2 py-0.5 text-[11px] font-semibold",
                                  statusBadgeClass(row),
                                ].join(" ")}
                              >
                                {statusLabel(row)}
                              </span>
                            </p>
                          </div>
                        </div>

                        {linked ? (
                          <div className="mt-3 space-y-2 border-t border-white/8 pt-3">
                            <p className="text-[12px] font-medium uppercase tracking-wide text-white/55">
                              Eltern
                            </p>
                            {row.parents.map((parent) => {
                              const showPushReminder = parent.push_active !== true;
                              return (
                                <div
                                  key={parent.user_id}
                                  className="min-w-0 rounded-lg border border-white/[0.06] bg-black/15 px-2.5 py-2.5 text-[14px] text-white/90 sm:px-3"
                                >
                                  <p className="text-[15px] font-semibold leading-snug text-white">
                                    {parentPrimaryLabel(parent)}
                                  </p>
                                  {parentShowEmailBelow(parent) ? (
                                    <p className="mt-0.5 truncate text-[12px] leading-snug text-white/55">
                                      {parent.email}
                                    </p>
                                  ) : null}
                                  <ParentPushStatusBadges parent={parent} />
                                  {showPushReminder ? (
                                    <PushReminderButton
                                      onClick={() => void handlePushReminder(parent, row.player_name)}
                                    />
                                  ) : null}
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="mt-3 space-y-3 border-t border-white/8 pt-3">
                            <p className="flex items-start gap-2 text-[14px] text-amber-200/95">
                              <span className="shrink-0" aria-hidden>
                                ⚠️
                              </span>
                              <span>Kein Elternaccount verknüpft</span>
                            </p>
                            <AppButton
                              type="button"
                              variant="secondary"
                              size="sm"
                              className="w-full sm:w-auto"
                              onClick={() => void handleCopyReminder(row.player_name)}
                            >
                              WhatsApp-Text kopieren
                            </AppButton>
                          </div>
                        )}
                      </GlassCard>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        )}
      </PremiumCard>
    </>
  );
};
