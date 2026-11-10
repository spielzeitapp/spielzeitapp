import { CenterHeader } from '../center/CenterHeader';

export function TournamentCenterHeader({ logoUrl }: { logoUrl?: string | null }) {
  return <CenterHeader title="Turniercenter" logoUrl={logoUrl} />;
}
