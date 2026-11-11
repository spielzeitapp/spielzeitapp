import { useInternalBasePath } from '../../demo/demoPaths';
import { CenterHeader } from '../center/CenterHeader';

export function TournamentCenterHeader({ logoUrl }: { logoUrl?: string | null }) {
  const basePath = useInternalBasePath();
  return <CenterHeader backTo={`${basePath}/termine`} title="Turniercenter" logoUrl={logoUrl} />;
}
