import type { DemoDataSource } from './demoDataSource';
import { downloadSeasonPlanPdf, type SeasonPlanRow } from '../lib/seasonPlanPdf';

/** Uses only the in-memory demo schedule, including locally changed demo dates. */
export async function downloadDemoSeasonPlanPdf(data: DemoDataSource) {
  const rows: SeasonPlanRow[] = data.events
    .filter(e => e.kind === 'match' || e.kind === 'tournament')
    .map(e => ({
      id: e.id,
      kind: e.kind === 'tournament' ? 'tournament' as const
        : e.match_type === 'friendly' ? 'friendly' as const : 'championship' as const,
      starts_at: e.starts_at, meeting_at: e.meeting_at, location: e.location,
      title: e.kind === 'tournament' ? 'Nachwuchsturnier' : 'Meisterschaftsspiel',
      is_home: e.is_home, opponent: e.opponent, opponent_logo_url: e.opponent_logo_url,
    }))
    .sort((a, b) => a.starts_at.localeCompare(b.starts_at));
  return downloadSeasonPlanPdf({
    teamName: data.teamName, ageGroup: 'U12', seasonName: data.seasonLabel,
    teamLogoUrl: '/logos/nsg-goelsental.png', rows, titleKind: 'saison',
    opponentLogoUrls: Object.fromEntries(rows
      .filter(r => r.opponent && r.opponent_logo_url)
      .map(r => [r.opponent!, r.opponent_logo_url!])),
  });
}
