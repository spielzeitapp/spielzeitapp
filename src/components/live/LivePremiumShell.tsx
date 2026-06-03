import React from 'react';
import { Link } from 'react-router-dom';
import { dsPrimaryCtaClass } from '../../lib/premiumDesignSystem';
import { PageShell, SectionTitle } from '../../ui';
import { cn } from '../../ui/lib/cn';

const SHELL_CLASS =
  'page live-page min-h-[100dvh] w-full max-w-none min-w-0 overflow-x-hidden px-3 py-6 sm:px-4 md:px-0';
const CONTENT_CLASS = 'mx-auto w-full min-w-0 max-w-none space-y-4 md:max-w-3xl lg:max-w-4xl';

/** Äußere Live-Seitenhülle (Übersicht, Leerzustände, Ladezustände — ohne Match-Engine). */
export function LivePremiumShell({
  children,
  centerContent = false,
}: {
  children: React.ReactNode;
  centerContent?: boolean;
}) {
  return (
    <PageShell
      variant="subtle"
      showAtmosphere={false}
      className={SHELL_CLASS}
      contentClassName={cn(
        CONTENT_CLASS,
        centerContent && 'flex min-h-[calc(100dvh-3rem)] flex-col items-center justify-center text-center',
      )}
    >
      {children}
    </PageShell>
  );
}

export function LivePageHeader({ subtitle }: { subtitle?: string }) {
  return (
    <SectionTitle
      subtitle={subtitle}
      className="[&>h1]:text-lg [&>h1]:font-bold [&>h1]:tracking-tight [&>h1]:normal-case"
    >
      Live
    </SectionTitle>
  );
}

export function LiveScheduleCtaLink({ className }: { className?: string }) {
  return (
    <Link
      to="/app/termine"
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
