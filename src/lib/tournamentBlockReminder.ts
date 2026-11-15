/** Match-clock based reminder: pauses never consume the change interval. */
export function tournamentBlockReminder(seconds: number, lastChange: number | null, minutes: number) {
  const interval = Math.max(1, Math.min(30, Number.isFinite(minutes) ? minutes : 6)) * 60;
  const remaining = Math.max(0, Math.ceil(interval - Math.max(0, seconds - (lastChange ?? 0))));
  return {remaining, due: remaining === 0, label:`${Math.floor(remaining / 60)}:${String(remaining % 60).padStart(2,'0')}`};
}
