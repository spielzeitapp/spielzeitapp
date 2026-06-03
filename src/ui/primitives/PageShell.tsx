import React from 'react';
import {
  dsMoreHubPageStyle,
  dsPageAtmosphereClass,
  dsPageContentClass,
  dsPageShellClass,
  dsSchedulePageStyle,
} from '../../lib/premiumDesignSystem';
import { cn } from '../lib/cn';

export type PageShellVariant = 'default' | 'subtle';
export type PageShellBackground = 'default' | 'schedule' | 'more';

export type PageShellProps = {
  children: React.ReactNode;
  /** default: Stadium-Atmosphäre (fixed); subtle: nur Shell-Gradient */
  variant?: PageShellVariant;
  /** Optionaler Seiten-Hintergrund (inline, wie Termine/Mehr) */
  background?: PageShellBackground;
  className?: string;
  contentClassName?: string;
  /** Atmosphäre auch bei variant=subtle (selten) */
  showAtmosphere?: boolean;
} & Omit<React.HTMLAttributes<HTMLDivElement>, 'className' | 'children'>;

function pageBackgroundStyle(background: PageShellBackground): React.CSSProperties | undefined {
  if (background === 'schedule') return dsSchedulePageStyle();
  if (background === 'more') return dsMoreHubPageStyle();
  return undefined;
}

/**
 * Vollseiten-Wrapper — dünn um dsPageShell / dsPageAtmosphere / dsPageContent.
 */
export const PageShell: React.FC<PageShellProps> = ({
  children,
  variant = 'default',
  background = 'default',
  className,
  contentClassName,
  showAtmosphere,
  style,
  ...rest
}) => {
  const useAtmosphere = showAtmosphere ?? variant === 'default';

  return (
    <div
      {...rest}
      className={cn(dsPageShellClass(), className)}
      style={{ ...pageBackgroundStyle(background), ...style }}
    >
      {useAtmosphere ? <div className={dsPageAtmosphereClass()} aria-hidden /> : null}
      <div className={dsPageContentClass(contentClassName)}>{children}</div>
    </div>
  );
};
