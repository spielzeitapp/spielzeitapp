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
        .push-onboarding-sheet {
          max-height: 92vh !important;
        }
        @media (max-height: 680px) {
          .push-onboarding-footer-hint {
            display: none;
          }
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
            '!flex !max-h-[92vh] !max-w-[420px] !flex-col !overflow-hidden',
            '!rounded-t-[20px] !border-white/[0.08] !bg-[#0A0A0C] !p-0',
            entered ? 'push-onboarding-sheet-enter' : 'opacity-0',
          ].join(' ')}
          style={{ boxShadow: SHEET_SHADOW }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="push-onboarding-title"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Hero — kompakt auf kleinen Screens (iPhone SE) */}
          <div className="relative h-[140px] w-full shrink-0 overflow-hidden rounded-t-[20px] max-[380px]:h-[135px] sm:h-[185px]">
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
              className="absolute right-2.5 top-2.5 z-10 flex h-7 w-7 items-center justify-center rounded-full border border-white/12 bg-black/40 text-sm leading-none text-white/75 backdrop-blur-sm transition hover:bg-black/55 hover:text-white"
              onClick={onRemindLater}
              aria-label="Schließen"
            >
              ✕
            </button>
          </div>

          {/* Content — kompakt, iPhone SE ohne Scroll/Abschneiden */}
          <div className="flex min-h-0 shrink flex-col px-4 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-2.5 sm:px-5 sm:pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:pt-3.5">
            <p className="text-center text-[9px] font-semibold uppercase tracking-[0.18em] text-red-400/85 sm:text-[10px]">
              SpielzeitApp
            </p>
            <h2
              id="push-onboarding-title"
              className="mt-0.5 text-center text-[1.05rem] font-bold leading-tight tracking-[-0.02em] text-white sm:mt-1 sm:text-[1.25rem]"
            >
              Keine wichtigen Infos verpassen
            </h2>
            <p className="mt-1.5 text-center text-[12px] leading-snug text-white/60 sm:mt-2 sm:text-[13px]">
              Aktiviere Benachrichtigungen und erhalte wichtige Informationen direkt aufs Handy.
            </p>

            <ul className="mt-2 space-y-0.5 sm:mt-3 sm:space-y-1">
              {BENEFIT_ROWS.map((row) => (
                <li
                  key={row.label}
                  className="flex items-center gap-2 text-[12px] leading-tight text-[#E8E4E6] sm:text-[13px]"
                >
                  <span className="w-4 shrink-0 text-center text-[13px] leading-none sm:w-5 sm:text-[14px]" aria-hidden>
                    {row.icon}
                  </span>
                  <span>{row.label}</span>
                </li>
              ))}
            </ul>

            <div className="mt-2.5 flex shrink-0 flex-col gap-1.5 sm:mt-4 sm:gap-2">
              <button
                type="button"
                disabled={busy || !pushReady}
                onClick={() => void onActivate()}
                className={[
                  'push-onboarding-cta-glow w-full',
                  dsPrimaryCtaClass(),
                  '!min-h-[44px] !rounded-xl !py-2 !text-[14px] sm:!min-h-[46px] sm:!rounded-2xl sm:!text-[15px]',
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
                  'w-full !min-h-[40px] !rounded-xl !py-2 !text-[14px] sm:!min-h-[42px] sm:!rounded-2xl sm:!text-[15px]',
                ].join(' ')}
              >
                Später erinnern
              </button>
            </div>

            <p className="push-onboarding-footer-hint mt-2 text-center text-[9px] leading-tight text-white/35 sm:mt-2.5 sm:text-[10px]">
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
      user,
    }).then((complete) => {
      if (alive) setOnboardingComplete(complete);
    });
    return () => {
      alive = false;
    };
  }, [user, sessionLoading, backendRole, previewRole, memberships]);

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
