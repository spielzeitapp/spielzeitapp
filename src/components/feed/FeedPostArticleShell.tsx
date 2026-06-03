import React from 'react';
import { GlassCard } from '../../ui';
import { cn } from '../../ui/lib/cn';

type Props = {
  children: React.ReactNode;
  className?: string;
} & Omit<React.ComponentProps<typeof GlassCard>, 'children' | 'className' | 'as'>;

/**
 * Einheitliche äußere Feed-Post-Hülle (dsFeedCardShell + Stadium-Border).
 */
export const FeedPostArticleShell = React.forwardRef<HTMLElement, Props>(function FeedPostArticleShell(
  { children, className, showAmbientGlow = false, ...rest },
  ref,
) {
  return (
    <GlassCard
      ref={ref}
      as="article"
      showAmbientGlow={showAmbientGlow}
      className={cn('w-full min-w-0 border-red-950/40 shadow-xl', className)}
      {...rest}
    >
      {children}
    </GlassCard>
  );
});
