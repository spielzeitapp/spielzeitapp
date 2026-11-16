import { useInternalBasePath } from '../../demo/demoPaths';
import { CenterHeader } from '../center/CenterHeader';

export function TournamentCenterHeader(_props: { logoUrl?: string | null } = {}) {
  const basePath = useInternalBasePath();
  return <CenterHeader backTo={`${basePath}/termine`} title="Turniercenter" />;
}
