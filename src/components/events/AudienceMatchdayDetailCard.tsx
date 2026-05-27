import React from 'react';
import { ChevronRight, Cloud, Clock, MapPin, Radio, ScrollText } from 'lucide-react';
import { Link } from 'react-router-dom';
import { Card, CardTitle } from '../../app/components/ui/Card';
import { dsMatchdaySectionLabelClass, dsPrimaryCtaClass } from '../../lib/premiumDesignSystem';
import { formatMeetupTimeOnlyDe } from '../match/matchCardLabels';
import type { EventStatus } from '../../hooks/useEvents';

type Props = {
  showMeetup: boolean;
  meetupAt: string | null;
  /** Treffpunkt-Ort (ausführlich auf der Detailseite). */
  meetupPlaceLine?: string;
  placeLine: string;
  addressLine: string;
  trainerNotes: string | null;
  status: EventStatus;
  matchId: string | null;
  onOpenLive?: () => void;
  onOpenReport?: () => void;
};

function InfoRow({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex gap-3 border-t border-white/[0.06] py-3 first:border-t-0 first:pt-0">
      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center text-[#B85C68]">{icon}</span>
      <div className="min-w-0 flex-1">
        <p className={dsMatchdaySectionLabelClass()}>{label}</p>
        <div className="mt-1 text-[14px] font-medium leading-snug text-white break-words">{children}</div>
      </div>
    </div>
  );
}

export const AudienceMatchdayDetailCard: React.FC<Props> = ({
  showMeetup,
  meetupAt,
  meetupPlaceLine = '',
  placeLine,
  addressLine,
  trainerNotes,
  status,
  matchId,
  onOpenLive,
  onOpenReport,
}) => {
  const meetupTime = formatMeetupTimeOnlyDe(meetupAt);
  const isLive = status === 'live';
  const isFinished = status === 'finished' || status === 'completed' || status === 'ended';

  return (
    <Card className="relative flex flex-col gap-0 overflow-hidden border border-white/[0.06] bg-[rgba(10,10,14,0.97)] px-3.5 py-3.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]">
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_90%_55%_at_50%_0%,rgba(122,29,42,0.10)_0%,transparent_58%)]"
        aria-hidden
      />
      <CardTitle className="relative z-[1] mb-1 text-[11px] font-bold uppercase tracking-[0.14em] text-red-400/85">
        Matchday Infos
      </CardTitle>

      <div className="relative z-[1]">
        <InfoRow icon={<Clock className="h-4 w-4" strokeWidth={2} aria-hidden />} label="Treffpunkt">
          {showMeetup && meetupTime ? (
            <div className="flex flex-col gap-0.5">
              <span className="tabular-nums">{meetupTime}</span>
              {meetupPlaceLine.trim() ? (
                <span className="text-[13px] font-normal text-white/75">{meetupPlaceLine.trim()}</span>
              ) : null}
            </div>
          ) : (
            <span className="text-white/45">–</span>
          )}
        </InfoRow>

        <InfoRow icon={<MapPin className="h-4 w-4" strokeWidth={2} aria-hidden />} label="Spielort">
          {placeLine || addressLine ? (
            <div className="flex flex-col gap-0.5">
              {placeLine ? <span>{placeLine}</span> : null}
              {addressLine ? <span className="text-[13px] font-normal text-white/75">{addressLine}</span> : null}
            </div>
          ) : (
            <span className="text-white/45">–</span>
          )}
        </InfoRow>

        {trainerNotes ? (
          <InfoRow icon={<ScrollText className="h-4 w-4" strokeWidth={2} aria-hidden />} label="Notizen Trainer">
            <span className="whitespace-pre-wrap text-[13px] font-normal leading-relaxed text-white/85">
              {trainerNotes}
            </span>
          </InfoRow>
        ) : null}

        <InfoRow icon={<Cloud className="h-4 w-4" strokeWidth={2} aria-hidden />} label="Wetter">
          <span className="text-[13px] font-normal text-white/50">Wird bald angezeigt</span>
        </InfoRow>

        {isLive && matchId ? (
          <InfoRow icon={<Radio className="h-4 w-4 animate-pulse" strokeWidth={2} aria-hidden />} label="Live">
            <div className="flex flex-col gap-0.5">
              <span className="text-[13px] text-white/75">Spiel ist live — Livestream &amp; Spielverlauf</span>
              {onOpenLive ? (
                <button
                  type="button"
                  className="mt-1 inline-flex items-center gap-1 text-[13px] font-semibold text-red-400"
                  onClick={onOpenLive}
                >
                  Zum Live-Zugang
                  <ChevronRight className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
                </button>
              ) : (
                <Link
                  to={`/app/live?matchId=${encodeURIComponent(matchId)}`}
                  className="mt-1 inline-flex items-center gap-1 text-[13px] font-semibold text-red-400"
                >
                  Zum Live-Zugang
                  <ChevronRight className="h-3.5 w-3.5" strokeWidth={2} aria-hidden />
                </Link>
              )}
            </div>
          </InfoRow>
        ) : null}

        {isFinished && matchId ? (
          <InfoRow icon={<ScrollText className="h-4 w-4" strokeWidth={2} aria-hidden />} label="Bericht">
            <div className="flex flex-col gap-0.5">
              <span className="text-[13px] font-normal text-white/55">Nach Spielende verfügbar</span>
              {onOpenReport ? (
                <button
                  type="button"
                  className="mt-1 inline-flex items-center gap-1 text-[13px] font-semibold text-white/80"
                  onClick={onOpenReport}
                >
                  Bericht ansehen
                  <ChevronRight className="h-3.5 w-3.5 text-white/40" strokeWidth={2} aria-hidden />
                </button>
              ) : null}
            </div>
          </InfoRow>
        ) : null}
      </div>
    </Card>
  );
};
