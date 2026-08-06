import React from 'react';
import { useDemo } from '../DemoContext';
import {
  dsCardAmbientGlowClass,
  dsCardShellClass,
  dsMatchdaySectionLabelClass,
  dsPageTitleClass,
  dsSublineClass,
} from '../../lib/premiumDesignSystem';

export function DemoLivePage(): React.ReactElement {
  const {
    live,
    bumpMinute,
    addGoalHome,
    addGoalAway,
    addSubOrInfo,
    finishMatch,
    resetLive,
  } = useDemo();

  const disabled = live.status === 'finished';
  const eventsDesc = [...live.events].reverse();

  return (
    <div className="space-y-4">
      <header className="space-y-1">
        <p className={dsMatchdaySectionLabelClass()}>LIVE-Ticker</p>
        <h2 className={dsPageTitleClass()}>
          {live.homeName.split('–')[0]?.trim()} – {live.awayName}
        </h2>
        <p className={dsSublineClass()}>
          Nur lokaler Demo-State · keine Pushs · keine Datenbank-Schreibvorgänge
        </p>
      </header>

      <div className={dsCardShellClass({ matchday: true, className: 'relative text-center' })}>
        <div className={dsCardAmbientGlowClass(true)} aria-hidden />
        <div className="relative z-10 space-y-2 py-2">
          <div className="flex items-center justify-center gap-2">
            {live.status === 'live' ? (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-[#FF2D2D]/20 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-[#FF2D2D]">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#FF2D2D]" />
                Live
              </span>
            ) : (
              <span className="rounded-full bg-white/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white/70">
                Beendet
              </span>
            )}
            <span className="text-xs font-semibold text-white/70">{live.minute}&apos;</span>
          </div>
          <p className="text-4xl font-bold tabular-nums tracking-tight text-white">
            {live.scoreHome}:{live.scoreAway}
          </p>
          <p className="text-xs text-white/55">
            {live.homeName} · {live.awayName}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <button
          type="button"
          disabled={disabled}
          onClick={bumpMinute}
          className="min-h-[44px] rounded-xl border border-white/15 bg-white/5 text-xs font-semibold text-white disabled:opacity-40"
        >
          Minute +1
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={addSubOrInfo}
          className="min-h-[44px] rounded-xl border border-white/15 bg-white/5 text-xs font-semibold text-white disabled:opacity-40"
        >
          Wechsel / Ereignis
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={addGoalHome}
          className="min-h-[44px] rounded-xl bg-[#FF2D2D] text-xs font-semibold text-white disabled:opacity-40"
        >
          Tor Rohrbach
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={addGoalAway}
          className="min-h-[44px] rounded-xl border border-[#FF2D2D]/40 bg-[#FF2D2D]/15 text-xs font-semibold text-[#FF8A8A] disabled:opacity-40"
        >
          Tor Loosdorf
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={finishMatch}
          className="col-span-2 min-h-[44px] rounded-xl border border-white/20 bg-black/40 text-xs font-semibold text-white disabled:opacity-40"
        >
          Spiel beenden
        </button>
        <button
          type="button"
          onClick={resetLive}
          className="col-span-2 min-h-[44px] rounded-xl border border-amber-400/40 bg-amber-500/10 text-xs font-semibold text-amber-100"
        >
          Demo zurücksetzen
        </button>
      </div>

      <section className="space-y-2">
        <h3 className="text-sm font-semibold text-white">Ereignischronik</h3>
        <ul className="space-y-1.5">
          {eventsDesc.map((ev) => (
            <li
              key={ev.id}
              className="flex gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2 text-xs"
            >
              <span className="w-8 shrink-0 font-bold tabular-nums text-[#FF8A8A]">{ev.minute}&apos;</span>
              <span className="text-white/80">{ev.text}</span>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
