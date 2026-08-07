import { Navigate } from 'react-router-dom';
import { DEMO_TOURNAMENT_EVENT_ID } from '../demoTournamentState';

/** DEMO.2G-A: Stub → produktives Turniercenter unter Event-Detail. */
export function DemoTournamentPage(): React.ReactElement {
  return <Navigate to={`/demo/events/${DEMO_TOURNAMENT_EVENT_ID}`} replace />;
}
