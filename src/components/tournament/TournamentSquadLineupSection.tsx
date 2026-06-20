import React from 'react';
import { Link } from 'react-router-dom';
import { ClipboardList, Users } from 'lucide-react';
import { matchLineupPath, matchPreparationPath } from '../../lib/matchPreparationAccess';
import { dsScheduleGlassButtonClass, dsStatusChipClass } from '../../lib/premiumDesignSystem';
import type { TournamentMatchSlotView } from '../../lib/tournamentPlan';
import { pickFeaturedTournamentSlot } from './tournamentCenterUtils';
import { TC_CARD, TC_CARD_INNER, TC_SECTION_LABEL } from './tournamentCenterStyles';

type Props = {
  slots: TournamentMatchSlotView[];
  loading?: boolean;
  canManage?: boolean;
};

function SectionShell({
  icon,
  title,
  statusLabel,
  statusTone,
  description,
  ctaLabel,
  ctaTo,
  disabled,
}: {
  icon: React.ReactNode;
  title: string;
  statusLabel: string;
  statusTone: 'present' | 'open' | 'neutral';
  description: string;
  ctaLabel: string;
  ctaTo: string;
  disabled?: boolean;
}) {
  return (
    <div className="rounded-lg border border-white/[0.06] bg-white/[0.02] px-2.5 py-2">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5">
          <span className="text-[13px] leading-none">{icon}</span>
          <span className="text-[11px] font-bold uppercase tracking-[0.1em] text-white/75">{title}</span>
        </span>
        <span className={dsStatusChipClass(statusTone)}>{statusLabel}</span>
      </div>
      <p className="text-[11px] leading-snug text-white/50">{description}</p>
      {disabled ? (
        <p className="mt-2 text-[11px] text-white/40">Zuerst Turnierspiel anlegen oder importieren.</p>
      ) : (
        <Link
          to={ctaTo}
          className={`mt-2 inline-flex min-h-[32px] w-full items-center justify-center rounded-full px-3 text-[11px] font-semibold touch-manipulation ${dsScheduleGlassButtonClass()}`}
        >
          {ctaLabel}
        </Link>
      )}
    </div>
  );
}

export function TournamentSquadLineupSection({ slots, loading = false, canManage = false }: Props) {
  if (!canManage) return null;

  const featured = pickFeaturedTournamentSlot(slots);
  const matchId = featured?.match_id?.trim() ?? '';
  const hasSquad = Boolean(featured?.has_squad);
  const hasLineup = Boolean(featured?.has_lineup);
  const opponent = featured?.opponent_name ?? null;

  if (loading) {
    return (
      <section className={TC_CARD}>
        <div className={TC_CARD_INNER}>
          <p className={TC_SECTION_LABEL}>Kader &amp; Aufstellung</p>
          <p className="mt-1 text-[12px] text-white/50">Lade…</p>
        </div>
      </section>
    );
  }

  return (
    <section className={TC_CARD}>
      <div className={`${TC_CARD_INNER} flex flex-col gap-1.5`}>
        <p className={TC_SECTION_LABEL}>Turnierorganisation</p>
        <SectionShell
          icon={<Users className="h-3.5 w-3.5 text-red-300/80" strokeWidth={2.25} aria-hidden />}
          title="Turnierkader"
          statusLabel={hasSquad ? 'Nominiert' : 'Offen'}
          statusTone={hasSquad ? 'present' : 'open'}
          description={
            opponent
              ? `Kader für vs ${opponent} — unabhängig von Zu-/Absagen, Verletzungen später anpassbar.`
              : 'Nominiere den Turnierkader pro Spiel in der Match-Vorbereitung.'
          }
          ctaLabel={hasSquad ? 'Kader bearbeiten' : 'Kader festlegen'}
          ctaTo={matchId ? matchPreparationPath(matchId) : '#'}
          disabled={!matchId}
        />
        <SectionShell
          icon={<ClipboardList className="h-3.5 w-3.5 text-red-300/80" strokeWidth={2.25} aria-hidden />}
          title="Aufstellung"
          statusLabel={hasLineup ? 'Vorbereitet' : 'Offen'}
          statusTone={hasLineup ? 'present' : 'neutral'}
          description="Formation, Startaufstellung und Ersatzspieler für das nächste Turnierspiel."
          ctaLabel={hasLineup ? 'Aufstellung öffnen' : 'Aufstellung erstellen'}
          ctaTo={matchId ? matchLineupPath(matchId) : '#'}
          disabled={!matchId}
        />
      </div>
    </section>
  );
}
