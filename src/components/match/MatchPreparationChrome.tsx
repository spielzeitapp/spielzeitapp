import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeft } from 'lucide-react';
import { normalizeOefbImportedTeamName } from '../../lib/oefbTeamNameNormalize';
import {
  dsPageHeaderClass,
  dsPageHeroGlowClass,
  dsStickyCtaBarClass,
} from '../../lib/premiumDesignSystem';

export const MATCH_PREPARATION_ACTIONS_CLASS =
  'flex flex-col gap-2.5 [&>button]:w-full [&>button]:min-w-0 [&>button]:!min-h-12 [&>button]:!whitespace-normal [&>button]:!px-2 [&>button]:!text-sm [&>button]:!leading-tight sm:[&>button]:!text-base';

export function MatchPreparationHeader({
  title,
  opponent,
  onBack,
  hasMatchCenter,
  backDisabled = false,
}: {
  title: string;
  opponent?: string | null;
  onBack: () => void;
  hasMatchCenter: boolean;
  backDisabled?: boolean;
}) {
  return (
    <header className={`${dsPageHeaderClass()} !relative !top-auto !p-0`}>
      <div className={dsPageHeroGlowClass()} aria-hidden />
      <div className="relative mx-auto flex w-full max-w-xl flex-col items-start gap-1 px-4 pb-2 pt-1 sm:pb-3 sm:pt-2">
        <button
          type="button"
          onClick={onBack}
          disabled={backDisabled}
          className="inline-flex min-h-11 items-center gap-1.5 rounded-xl px-1 text-sm font-semibold text-white/80 hover:text-white disabled:opacity-50"
        >
          <ArrowLeft className="h-5 w-5 shrink-0 text-red-300" aria-hidden />
          {hasMatchCenter ? 'Zurück zum Matchcenter' : 'Zurück'}
        </button>
        <div className="flex w-full min-w-0 flex-wrap items-baseline gap-x-3 gap-y-0.5">
          <h1 className="min-w-0 break-words text-2xl font-black leading-tight tracking-tight">{title}</h1>
          {opponent ? (
            <p className="min-w-0 break-words text-sm font-semibold text-white/70">
              vs. {normalizeOefbImportedTeamName(opponent) || opponent}
            </p>
          ) : null}
        </div>
      </div>
    </header>
  );
}

export function MatchPreparationActions({
  children,
  fixedAt,
}: {
  children: ReactNode;
  fixedAt?: 'bottom' | 'above-navigation';
}) {
  if (!fixedAt) {
    return <footer className="mt-5 flex min-w-0 flex-col gap-3 border-t border-red-400/20 pt-4">{children}</footer>;
  }
  if (typeof document === 'undefined') return null;

  return createPortal(
    <div
      className={`${dsStickyCtaBarClass()} box-border !border-red-400/20 max-sm:!px-3`}
      style={{
        bottom: fixedAt === 'above-navigation' ? 'calc(env(safe-area-inset-bottom, 0px) + 96px)' : 'calc(env(safe-area-inset-bottom, 0px) + 4px)',
        paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom, 0px))',
      }}
    >
      <div className="mx-auto flex w-full min-w-0 max-w-xl flex-col gap-2">
        {children}
      </div>
    </div>,
    document.body,
  );
}
