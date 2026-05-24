import React from 'react';
import { CircleHelp, ThumbsDown, ThumbsUp } from 'lucide-react';
import { triggerHaptic } from '../../lib/hapticFeedback';
import type { AttendanceStatusKind } from './AttendanceStatusPill';
import { AppButton } from '../ui/AppButton';

type Props = {
  status: AttendanceStatusKind;
  isTraining: boolean;
  onOpen: () => void;
  /** Hero: 46×46 Glass; Liste: Standard. */
  context?: 'hero' | 'list';
  className?: string;
};

const btnList =
  'ml-2 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border p-0 transition-all duration-200';

const btnHeroGlass =
  'inline-flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-full border border-white/10 bg-[rgba(10,10,12,0.78)] p-0 backdrop-blur-md shadow-[inset_0_1px_0_rgba(255,255,255,0.05)] transition-all duration-200';

/** Eltern/Spieler: Daumen in Hero oder „Weitere Termine“. */
export function CompactListParentAttendance({
  status,
  isTraining,
  onOpen,
  context = 'list',
  className = '',
}: Props) {
  const isHero = context === 'hero';
  const iconClass = isHero ? 'h-6 w-6' : 'h-5 w-5';

  const yesList = 'border-emerald-400/45 bg-emerald-600/85 text-white shadow-[0_0_16px_rgba(16,185,129,0.35)]';
  const noList = 'border-red-400/45 bg-red-600/85 text-white shadow-[0_0_16px_rgba(239,68,68,0.35)]';
  const pendingList = 'border-white/20 bg-zinc-700/75 text-white/90';

  const yesHero =
    'border-emerald-500/32 text-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.14)] hover:border-emerald-500/42';
  const noHero =
    'border-[rgba(122,29,42,0.38)] text-[#E8A8B0] shadow-[0_0_12px_rgba(122,29,42,0.14)] hover:border-[rgba(122,29,42,0.48)]';
  const pendingHero = 'border-white/14 text-white/75 shadow-[0_0_8px_rgba(0,0,0,0.2)]';

  const openModal = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    triggerHaptic();
    onOpen();
  };

  if (isHero) {
    const tone =
      status === 'yes' || (isTraining && status !== 'no')
        ? yesHero
        : status === 'no'
          ? noHero
          : pendingHero;
    const Icon =
      status === 'no' ? ThumbsDown : status === 'yes' || (isTraining && status !== 'no') ? ThumbsUp : CircleHelp;
    const label =
      status === 'no' ? 'Abgesagt' : status === 'yes' || (isTraining && status !== 'no') ? 'Dabei' : 'Offen';

    return (
      <button
        type="button"
        className={`${btnHeroGlass} ${tone} ${className}`}
        onClick={openModal}
        aria-label={label}
      >
        <Icon className={iconClass} strokeWidth={2.25} aria-hidden />
      </button>
    );
  }

  const btnBase = btnList;
  const yesGlow = yesList;
  const noGlow = noList;
  const pendingClass = pendingList;

  if (isTraining) {
    if (status === 'no') {
      return (
        <AppButton
          type="button"
          variant="danger"
          size="sm"
          className={`${btnBase} ${noGlow} ${className}`}
          onClick={openModal}
          aria-label="Abgesagt"
        >
          <ThumbsDown className={iconClass} strokeWidth={2} aria-hidden />
        </AppButton>
      );
    }
    return (
      <AppButton
        type="button"
        variant="success"
        size="sm"
        className={`${btnBase} ${yesGlow} ${className}`}
        onClick={openModal}
        aria-label="Dabei"
      >
        <ThumbsUp className={iconClass} strokeWidth={2} aria-hidden />
      </AppButton>
    );
  }

  if (status === 'yes') {
    return (
      <AppButton
        type="button"
        variant="success"
        size="sm"
        className={`${btnBase} ${yesGlow} ${className}`}
        onClick={openModal}
        aria-label="Zugesagt"
      >
        <ThumbsUp className={iconClass} strokeWidth={2} aria-hidden />
      </AppButton>
    );
  }
  if (status === 'no') {
    return (
      <AppButton
        type="button"
        variant="danger"
        size="sm"
        className={`${btnBase} ${noGlow} ${className}`}
        onClick={openModal}
        aria-label="Abgesagt"
      >
        <ThumbsDown className={iconClass} strokeWidth={2} aria-hidden />
      </AppButton>
    );
  }
  return (
    <AppButton
      type="button"
      variant="pending"
      size="sm"
      className={`${btnBase} ${pendingClass} ${className}`}
      onClick={openModal}
      aria-label="Offen"
    >
      <CircleHelp className={iconClass} strokeWidth={2} aria-hidden />
    </AppButton>
  );
}
