import { scheduleClubName } from './scheduleClubIdentity';
export function isUscRohrbachResult(name: string | null | undefined): boolean {
  return /^USC\s+(?:kaschütz\s+)?Rohrbach$/i.test(scheduleClubName(name ?? ''));
}
export function uscResultCaption(own: string, opponent: string, ourScore: number, opponentScore: number): string {
  const name = scheduleClubName(own), other = scheduleClubName(opponent);
  const outcome = ourScore > opponentScore ? 'gewinnt gegen' : ourScore < opponentScore ? 'verliert gegen' : 'spielt unentschieden gegen';
  return `${name} ${outcome} ${other} mit ${ourScore}:${opponentScore}.\n#GEMEINSAMSTARK`;
}
