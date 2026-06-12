import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { useLocation } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { useSession } from '../auth/useSession';
import { usePushSubscription } from '../hooks/usePushSubscription';
import {
  evaluatePushOnboardingGate,
  isUserOnboardingComplete,
} from '../lib/pushOnboardingGate';
import { markPushOnboardingRemindLater } from '../lib/pushOnboardingPrompt';
import { lockBodyScroll } from '../lib/bodyScrollLock';
import { dsPrimaryCtaClass, dsSecondaryCtaClass } from '../lib/premiumDesignSystem';

const SHEET_SHADOW =
  '0 0 0 1px rgba(220, 38, 38, 0.1), 0 24px 48px -12px rgba(0, 0, 0, 0.82), 0 0 64px -32px rgba(122, 29, 42, 0.18)';

const BENEFIT_ROWS = [
  { icon: '⚽', label: 'Spieltermine & Ergebnisse' },
  { icon: '🏃', label: 'Trainings & Absagen' },
  { icon: '📍', label: 'Treffpunkte & Anreise' },
  { icon: '🔔', label: 'Wichtige Änderungen' },
] as const;

function assetUrl(path: string): string {
  const base = import.meta.env.BASE_URL || '/';
  return base.endsWith('/') ? `${base}${path}` : `${base}/${path}`;
}

const PUSH_HERO_SRC = assetUrl('images/push-onboarding-hero.jpg');

type PushOnboardingSheetProps = {
  busy: boolean;
  pushReady: boolean;
  onActivate: () => void;
  onRemindLater: () => void;
  entered: boolean;
};

function PushOnboardingSheet({
  busy,
  pushReady,
  onActivate,
  onRemindLater,
  entered,
}: PushOnboardingSheetProps): React.ReactElement {
  return (
    <>
      <style>{`
        @keyframes pushOnboardingOverlayIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes pushOnboardingSheetIn {
          from {
            opacity: 0;
            transform: translateY(14px) scale(0.98);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
        @keyframes pushOnboardingCtaGlow {
          0%, 100% {
            box-shadow:
              0 0 20px rgba(122, 29, 42, 0.32),
              inset 0 1px 0 rgba(255, 255, 255, 0.1),
              0 4px 16px rgba(0, 0, 0, 0.38);
          }
          50% {
            box-shadow:
              0 0 28px rgba(220, 38, 38, 0.42),
              inset 0 1px 0 rgba(255, 255, 255, 0.12),
              0 5px 20px rgba(0, 0, 0, 0.42);
          }
        }
        .push-onboarding-overlay-enter {
          animation: pushOnboardingOverlayIn 0.28s ease-out forwards;
        }
        .push-onboarding-sheet-enter {
          animation: pushOnboardingSheetIn 0.34s cubic-bezier(0.22, 1, 0.36, 1) forwards;
        }
        .push-onboarding-cta-glow {
          animation: pushOnboardingCtaGlow 2.4s ease-in-out infinite;
        }
      `}</style>

      <div
        className={[
          'modalOverlay !bg-black/65 !backdrop-blur-[3px]',
          entered ? 'push-onboarding-overlay-enter' : 'opacity-0',
        ].join(' ')}
        onClick={onRemindLater}
        role="presentation"
      >
        <div
          className={[
            'modalSheet push-onboarding-sheet',
            '!flex !max-w-[420px] !flex-col !overflow-hidden !overflow-y-hidden',
            '!rounded-t-[22px] !border-white/[0.08] !bg-[#0A0A0C] !p-0',
            entered ? 'push-onboarding-sheet-enter' : 'opacity-0',
          ].join(' ')}
          style={{ boxShadow: SHEET_SHADOW }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="push-onboarding-title"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Hero — Vereins-/Familienfoto, ruhiger Verlauf */}
          <div className="relative h-[180px] w-full shrink-0 overflow-hidden rounded-t-[22px] sm:h-[200px]">
            <img
              src={PUSH_HERO_SRC}
              alt=""
              className="absolute inset-0 h-full w-full object-cover object-center"
            />
            <div
              className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#0A0A0C] via-[#0A0A0C]/55 to-transparent"
              aria-hidden
            />

            <button
              type="button"
              className="absolute right-3 top-3 z-10 flex h-8 w-8 items-center justify-center rounded-full border border-white/12 bg-black/40 text-base leading-none text-white/75 backdrop-blur-sm transition hover:bg-black/55 hover:text-white"
              onClick={onRemindLater}
              aria-label="Schließen"
            >
              ✕
            </button>
          </div>

          {/* Content — kompakt, iPhone SE ohne Scroll */}
          <div className="flex min-h-0 flex-1 flex-col px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3.5 sm:px-5 sm:pt-4">
            <p className="text-center text-[10px] font-semibold uppercase tracking-[0.2em] text-red-400/85">
              SpielzeitApp
            </p>
            <h2
              id="push-onboarding-title"
              className="mt-1 text-center text-[1.2rem] font-bold leading-snug tracking-[-0.02em] text-white sm:text-[1.35rem]"
            >
              Keine wichtigen Infos verpassen
            </h2>
            <p className="mt-2 text-center text-[13px] leading-snug text-white/62 sm:text-sm">
              Aktiviere Benachrichtigungen und erhalte wichtige Informationen direkt aufs Handy.
            </p>

            <ul className="mt-3.5 space-y-1.5 sm:mt-4 sm:space-y-2">
              {BENEFIT_ROWS.map((row) => (
                <li
                  key={row.label}
                  className="flex items-center gap-2.5 text-[13px] leading-snug text-[#E8E4E6] sm:text-[0.9rem]"
                >
                  <span className="w-5 shrink-0 text-center text-[15px] leading-none" aria-hidden>
                    {row.icon}
                  </span>
                  <span>{row.label}</span>
                </li>
              ))}
            </ul>

            <div className="mt-4 flex flex-col gap-2 sm:mt-5">
              <button
                type="button"
                disabled={busy || !pushReady}
                onClick={() => void onActivate()}
                className={[
                  'push-onboarding-cta-glow w-full',
                  dsPrimaryCtaClass(),
                  '!min-h-[46px] !rounded-2xl !py-2.5 !text-[15px]',
                ].join(' ')}
              >
                {busy ? 'Wird aktiviert…' : 'Benachrichtigungen aktivieren'}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={onRemindLater}
                className={[
                  dsSecondaryCtaClass(),
                  'w-full !min-h-[42px] !rounded-2xl !py-2.5 !text-[15px]',
                ].join(' ')}
              >
                Später erinnern
              </button>
            </div>

            <p className="mt-2.5 text-center text-[10px] leading-snug text-white/38 sm:mt-3 sm:text-[11px]">
              Du kannst Benachrichtigungen jederzeit in den Einstellungen ändern.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}

/**
 * Datenschutzkonformer Push-Hinweis nach Onboarding / für Nutzer ohne aktive Subscription.
 * requestPermission nur nach Klick auf „Benachrichtigungen aktivieren“.
 */
export const PushOnboardingPrompt: React.FC = () => {
  const { user } = useAuth();
  const location = useLocation();
  const {
    loading: sessionLoading,
    effectiveRole,
    backendRole,
    previewRole,
    memberships,
  } = useSession();

  const push = usePushSubscription(user?.id);
  const [onboardingComplete, setOnboardingComplete] = useState<boolean | null>(null);
  const [open, setOpen] = useState(false);
  const [entered, setEntered] = useState(false);

  useEffect(() => {
    if (!user?.id || sessionLoading) {
      setOnboardingComplete(null);
      return;
    }
    let alive = true;
    void isUserOnboardingComplete({
      userId: user.id,
      backendRole,
      previewRole,
      memberships,
    }).then((complete) => {
      if (alive) setOnboardingComplete(complete);
    });
    return () => {
      alive = false;
    };
  }, [user?.id, sessionLoading, backendRole, previewRole, memberships]);

  const shouldShow = useMemo(
    () =>
      evaluatePushOnboardingGate({
        userId: user?.id,
        sessionLoading,
        effectiveRole,
        backendRole,
        previewRole,
        memberships,
        pathname: location.pathname,
        permission: push.permission,
        subscriptionActive: push.subscriptionActive,
        pushInitDone: push.initDone,
        browserOk: push.browserOk,
        onboardingComplete,
      }),
    [
      user?.id,
      sessionLoading,
      effectiveRole,
      backendRole,
      previewRole,
      memberships,
      location.pathname,
      push.permission,
      push.subscriptionActive,
      push.initDone,
      push.browserOk,
      onboardingComplete,
    ],
  );

  useEffect(() => {
    setOpen(shouldShow);
  }, [shouldShow]);

  useEffect(() => {
    if (!open) {
      setEntered(false);
      return;
    }
    const id = window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => setEntered(true));
    });
    return () => window.cancelAnimationFrame(id);
  }, [open]);

  const handleRemindLater = useCallback(() => {
    if (user?.id) markPushOnboardingRemindLater(user.id);
    setOpen(false);
  }, [user?.id]);

  useEffect(() => {
    if (!open) return;
    return lockBodyScroll();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') handleRemindLater();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, handleRemindLater]);

  const handleActivate = useCallback(async () => {
    const result = await push.activate();
    if (result.ok) {
      setOpen(false);
      return;
    }
    if (user?.id) markPushOnboardingRemindLater(user.id);
    setOpen(false);
  }, [push, user?.id]);

  if (!open || typeof document === 'undefined') return null;

  const busy = push.loading && push.loadingAction === 'activate';

  return createPortal(
    <PushOnboardingSheet
      busy={busy}
      pushReady={push.pushReady}
      onActivate={handleActivate}
      onRemindLater={handleRemindLater}
      entered={entered}
    />,
    document.body,
  );
};
