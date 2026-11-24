import React from 'react';
import { ChevronRight, Radio, Shirt } from 'lucide-react';
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

const choiceClass = 'flex min-h-[72px] w-full items-center gap-3 rounded-2xl border px-3 py-3 text-left text-white transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-red-300';
const primaryChoiceClass = 'border-red-400/35 bg-red-950/65 hover:bg-red-900/60';
const secondaryChoiceClass = 'border-white/15 bg-white/[0.045] hover:bg-white/[0.09]';
const choiceIconClass = 'grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-red-400/20 bg-red-950/35 text-red-200';

export function MatchStartChoiceDialog({ open, matchLabel, onClose: closeChoice, withLineupPath, withoutLineupPath, lineupState, needsSquad }: Props) {
  return (
    <Modal open={open} title="Spiel starten" onClose={closeChoice} placement="center" className="matchStartChoiceModal">
      <div className="flex flex-col gap-3">
        <p className="mb-1 break-words text-center text-sm font-semibold text-white/75">{matchLabel}</p>
        {withoutLineupPath ? (
          <Link
            to={withoutLineupPath}
            onClick={closeChoice}
            className={`${choiceClass} ${primaryChoiceClass}`}
          >
            <span className={choiceIconClass} aria-hidden>
              <Radio className="h-5 w-5" />
            </span>
            <span className="min-w-0 flex-1">
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
          className={`${choiceClass} ${withoutLineupPath ? secondaryChoiceClass : primaryChoiceClass}`}
        >
          <span className={choiceIconClass} aria-hidden>
            <Shirt className="h-5 w-5" />
          </span>
          <span className="min-w-0 flex-1">
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
