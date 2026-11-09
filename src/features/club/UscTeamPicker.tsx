import React, { useEffect, useRef } from "react";
import type { ClubSeason } from "./uscClub";
export function UscTeamPicker({ seasons, selectedId, onSelect }: { seasons: ClubSeason[]; selectedId: string; onSelect: (id: string) => void }) {
  const bar = useRef<HTMLDivElement>(null);
  const touch = useRef<{ x: number; y: number } | null>(null);
  const index = seasons.findIndex((season) => season.id === selectedId);
  useEffect(() => { bar.current?.querySelector<HTMLElement>('[aria-pressed="true"]')?.scrollIntoView({ block: "nearest", inline: "nearest" }); }, [selectedId]);
  const choose = (next: number, focus = false) => {
    const target = seasons[Math.max(0, Math.min(seasons.length - 1, next))];
    if (!target) return;
    onSelect(target.id);
    if (focus) bar.current?.querySelectorAll<HTMLButtonElement>("button")[seasons.indexOf(target)]?.focus();
  };
  return <div className="usc-team-picker" role="group" aria-label="Mannschaft wählen">
    <div className="usc-team-picker-heading"><span>Mannschaften · tippen oder wischen</span><span>{seasons[index]?.season?.name}</span></div>
    <div className="usc-team-chips" ref={bar}
      onTouchStart={(event) => { const point = event.touches[0]; touch.current = point ? { x: point.clientX, y: point.clientY } : null; }}
      onTouchEnd={(event) => { const start = touch.current; touch.current = null; const end = event.changedTouches[0]; if (!start || !end) return; const dx = end.clientX - start.x, dy = end.clientY - start.y; if (Math.abs(dx) > 48 && Math.abs(dx) > Math.abs(dy) * 1.4) choose(index + (dx < 0 ? 1 : -1)); }}
      onTouchCancel={() => { touch.current = null; }}
      onKeyDown={(event) => { const next = event.key === "ArrowRight" ? index + 1 : event.key === "ArrowLeft" ? index - 1 : event.key === "Home" ? 0 : event.key === "End" ? seasons.length - 1 : null; if (next != null) { event.preventDefault(); choose(next, true); } }}>
      {seasons.map((season) => <button key={season.id} type="button" aria-label={`${season.age_group === "RES" ? "Reserve" : season.age_group} · ${season.season?.name}`} aria-pressed={season.id === selectedId} onClick={() => onSelect(season.id)}>{season.age_group === "RES" ? "Reserve" : season.age_group}{season.season?.name !== seasons[index]?.season?.name ? ` · ${season.season?.name}` : ""}</button>)}
    </div>
  </div>;
}
