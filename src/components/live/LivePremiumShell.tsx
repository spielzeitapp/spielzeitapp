import React from 'react';
import { Link } from 'react-router-dom';
import { dsPrimaryCtaClass } from '../../lib/premiumDesignSystem';
import { useInternalBasePath } from '../../demo/demoPaths';
import { PageShell, SectionTitle } from '../../ui';
import { cn } from '../../ui/lib/cn';

const SHELL_CLASS =
  'page live-page min-h-[100dvh] w-full max-w-none min-w-0 overflow-x-hidden px-3 py-6 sm:px-4 md:px-0';
const SHELL_CLASS_MATCH_CENTER =
  'page live-page min-h-[100dvh] w-full max-w-none min-w-0 overflow-x-hidden px-3 py-1 sm:px-4 sm:py-1 md:px-0';
const CONTENT_CLASS = 'mx-auto w-full min-w-0 max-w-none space-y-4 md:max-w-3xl lg:max-w-4xl';
const CONTENT_CLASS_COMPACT = 'mx-auto w-full min-w-0 max-w-none space-y-0 md:max-w-3xl lg:max-w-4xl';

/** Äußere Live-Seitenhülle (Übersicht, Leerzustände, Ladezustände — ohne Match-Engine). */
export function LivePremiumShell({
  children,
  centerContent = false,
  matchCenter = false,
}: {
  children: React.ReactNode;
  centerContent?: boolean;
  /** Extra Bottom-Padding für Match Center (Bottom Nav + Safe Area). */
  matchCenter?: boolean;
}) {
  return (
    <PageShell
      variant="subtle"
      showAtmosphere={false}
      className={matchCenter ? SHELL_CLASS_MATCH_CENTER : SHELL_CLASS}
      contentClassName={cn(
        matchCenter ? CONTENT_CLASS_COMPACT : CONTENT_CLASS,
        matchCenter && 'pb-[max(0.5rem,env(safe-area-inset-bottom,0px))]',
        centerContent && 'flex min-h-[calc(100dvh-3rem)] flex-col items-center justify-center text-center',
      )}
    >
      {children}
    </PageShell>
  );
}

export function LivePageHeader({
  title = 'Live',
  subtitle,
}: {
  title?: string;
  subtitle?: string;
}) {
  return (
    <SectionTitle
      subtitle={subtitle}
      className="mb-3.5 [&>h1]:mb-0 [&>h1]:text-2xl [&>h1]:font-bold [&>h1]:leading-none [&>h1]:tracking-tight [&>h1]:normal-case [&>p]:mt-0.5 [&>p]:text-xs [&>p]:leading-snug [&>p]:text-white/45"
    >
      {title}
    </SectionTitle>
  );
}

export function LiveScheduleCtaLink({ className }: { className?: string }) {
  const basePath = useInternalBasePath();
  return (
    <Link
      to={`${basePath}/termine`}
      className={cn(
        dsPrimaryCtaClass(),
        'inline-flex min-h-[48px] touch-manipulation items-center justify-center px-5 py-3',
        className,
      )}
    >
      Zum Spielplan
    </Link>
  );
}
