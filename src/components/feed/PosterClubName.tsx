import React from 'react';
import { parseClubDisplayName } from '../../lib/feedClubNaming';

/** Feste zwei Zeilen: Vereinskürzel oben, vollständiger Ortsname darunter. */
export function PosterClubName({ name }: { name: string }) {
  const { line1, line2 } = parseClubDisplayName(name);
  return <span className="block text-center">
    <span className="block whitespace-nowrap">{line1}</span>
    {line2 ? <span className="block whitespace-nowrap">{line2}</span> : null}
  </span>;
}
