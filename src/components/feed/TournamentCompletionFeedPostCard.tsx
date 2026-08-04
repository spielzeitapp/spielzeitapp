import React from 'react';
import { Trophy } from 'lucide-react';
import type { TeamFeedPostDbRow } from '../../lib/matchdayFeedTypes';
import type { TournamentCompletionFeedPayload } from '../../lib/tournamentCompletionFeed';
import { FeedPostDeleteButton } from './FeedPostDeleteButton';
import { toFeedPostDeleteInput } from '../../lib/deleteTeamFeedPost';

type Props = {
  post: TeamFeedPostDbRow;
  teamLabel: string;
  seasonLabel?: string | null;
  staffCanDelete?: boolean;
  onFeedPostDeleted?: () => void;
};

function parsePayload(raw: unknown): TournamentCompletionFeedPayload | null {
  if (!raw || typeof raw !== 'object') return null;
  const p = raw as Record<string, unknown>;
  if (typeof p.event_id !== 'string') return null;
  return p as unknown as TournamentCompletionFeedPayload;
}

export function TournamentCompletionFeedPostCard({
  post,
  teamLabel,
  seasonLabel,
  staffCanDelete,
  onFeedPostDeleted,
}: Props) {
  const payload = parsePayload(post.payload);
  const caption = post.caption?.trim() || 'Turnier abgeschlossen';
  const season = (seasonLabel ?? '').trim();

  return (
    <article className="overflow-hidden rounded-[18px] border border-amber-500/25 bg-[linear-gradient(165deg,rgba(88,62,12,0.28)_0%,rgba(10,8,12,0.96)_45%)] shadow-[0_12px_40px_rgba(0,0,0,0.45)]">
      <div className="flex items-center justify-between gap-2 border-b border-white/[0.06] px-3 py-2">
        <span className="inline-flex min-w-0 items-center gap-1.5 text-[11px] font-bold uppercase tracking-wide text-amber-200/90">
          <Trophy className="h-3.5 w-3.5 shrink-0" strokeWidth={2} aria-hidden />
          <span className="truncate">
            {teamLabel}
            {season ? ` · ${season}` : ''}
          </span>
        </span>
        {staffCanDelete ? (
          <FeedPostDeleteButton
            input={toFeedPostDeleteInput(post)}
            onDeleted={() => onFeedPostDeleted?.()}
          />
        ) : null}
      </div>
      <div className="px-3 py-3">
        <p className="whitespace-pre-wrap text-[14px] leading-relaxed text-white/88">{caption}</p>
        {payload?.results && payload.results.length > 0 ? (
          <ul className="mt-2.5 flex flex-col gap-1 border-t border-white/[0.06] pt-2.5">
            {payload.results.map((row) => (
              <li key={`${row.opponent}-${row.kickoff}`} className="flex justify-between gap-2 text-[12px] text-white/70">
                <span className="truncate">{row.opponent}</span>
                <span className="shrink-0 tabular-nums">
                  {row.kickoff} · {row.scoreLine}
                </span>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </article>
  );
}
