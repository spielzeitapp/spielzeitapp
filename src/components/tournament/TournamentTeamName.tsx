import React from 'react';

export function splitTournamentTeamName(name: string): { prefix: string | null; club: string } {
  const match = name.match(/^([A-ZÄÖÜ0-9.]{2,8}(?:\s+[A-ZÄÖÜ.]{2,4})?)\s+(.+)$/);
  return match ? { prefix: match[1], club: match[2] } : { prefix: null, club: name };
}

/** Stack short club names under their abbreviation in tournament cards. */
export function TournamentTeamName({ name }: { name: string }) {
  const { prefix, club } = splitTournamentTeamName(name);
  if (!prefix || /\s/.test(club)) return <>{name}</>;
  return <><span className="whitespace-nowrap">{prefix}</span>{' '}<br />{club}</>;
}
