import React, { useState } from 'react';
import { Share2 } from 'lucide-react';
import type { TeamFeedPostDbRow } from '../../lib/matchdayFeedTypes';
import { shareFeedContent } from '../../lib/feedShare';
import { useFeedMediaSrc } from '../../hooks/useFeedMediaSrc';
import { FeedWhatsAppStatusButton } from './FeedWhatsAppStatusButton';

/** Share controls for informational feed cards without the like/comment row. */
export function FeedPostShareActions({ post }: { post: TeamFeedPostDbRow }) {
  const src = useFeedMediaSrc(post.media_url);
  const [hint, setHint] = useState<string | null>(null);
  const onShare = async () => {
    const outcome = await shareFeedContent({
      title: 'SpielzeitApp', text: post.caption?.trim() || 'Neuigkeiten aus unserem Team',
      fetchUrl: src, fileName: 'spielzeit-feed.jpg',
    });
    if (outcome === 'aborted') return;
    setHint(outcome === 'shared' ? 'Geteilt.' : outcome === 'copied' ? 'Text kopiert.' : 'Teilen nicht möglich.');
  };
  return <div className="border-t border-white/[0.06]">
    <button type="button" onClick={() => void onShare()} className="flex min-h-[44px] w-full items-center justify-center gap-2 text-sm font-semibold text-white/80">
      <Share2 className="h-4 w-4" aria-hidden /> Beitrag teilen
    </button>
    {hint ? <p className="px-3 text-center text-xs text-white/55" role="status">{hint}</p> : null}
    <FeedWhatsAppStatusButton onShareFallback={() => void onShare()} />
  </div>;
}
