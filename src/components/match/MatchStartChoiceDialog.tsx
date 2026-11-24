import React from 'react';
import { ChevronRight } from 'lucide-react';
import { Link, type LinkProps } from 'react-router-dom';
import { Modal } from '../../app/ui/Modal';
import { dsSecondaryCtaClass } from '../../lib/premiumDesignSystem';

type Props = {
  open: boolean;
  matchLabel: string;
  onClose: () => void;
  withLineupPath: string;
  withoutLineupPath?: string;
  lineupState?: LinkProps['state'];
  needsSquad?: boolean;
};

const choiceClass = 'flex min-h-[70px] w-full items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-left';

export function MatchStartChoiceDialog({ open, matchLabel, onClose: closeChoice, withLineupPath, withoutLineupPath, lineupState, needsSquad }: Props) {
  return (
    <Modal open={open} title="Spiel starten" onClose={closeChoice}>
      <div className="space-y-2.5">
        <p className="mb-3 text-sm font-semibold text-white/65">{matchLabel}</p>
        {withoutLineupPath ? (
          <Link
            to={withoutLineupPath}
            onClick={closeChoice}
            className={`${choiceClass} border-red-400/35 bg-red-950/45 text-white hover:bg-red-950/70`}
          >
            <span>
              <span className="block text-base font-bold">Ohne Aufstellung</span>
              <span className="mt-1 block text-sm text-white/65">Direkt zum Liveticker</span>
            </span>
            <ChevronRight className="h-5 w-5 shrink-0 text-red-200" aria-hidden />
          </Link>
        ) : null}
        <Link
          to={withLineupPath}
          state={lineupState}
          onClick={closeChoice}
          className={`${choiceClass} border-white/15 bg-white/[0.04] text-white hover:bg-white/[0.08]`}
        >
          <span>
            <span className="block text-base font-bold">Mit Aufstellung</span>
            <span className="mt-1 block text-sm text-white/65">
              {needsSquad ? 'Zuerst den Spielkader wählen' : 'Startaufstellung festlegen'}
            </span>
          </span>
          <ChevronRight className="h-5 w-5 shrink-0 text-white/55" aria-hidden />
        </Link>
        <button type="button" onClick={closeChoice} className={`${dsSecondaryCtaClass()} min-h-11 w-full px-4 text-sm font-semibold`}>
          Abbrechen
        </button>
      </div>
    </Modal>
  );
}
