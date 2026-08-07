/**
 * DEMO.2I-FIX — fiktives Trainerteam (nur /demo).
 * IDs coach01 / coach02 sind stabil; Porträts unter public/avatars/demo/.
 */

import type { TeamStaffMember } from '../hooks/useTeamStaff';
import { DEMO_PLAYER_AVATAR_DIR } from './demoPlayers';

export type DemoStaffMember = {
  id: string;
  firstName: string;
  lastName: string;
  role: 'head_coach' | 'co_trainer';
  /** Immer true — KI-generierte Demo-Personen. */
  aiGenerated: true;
};

export const DEMO_HEAD_COACH_ID = 'coach01';
export const DEMO_CO_TRAINER_ID = 'coach02';

/** Zentrale Trainerdaten (Markus bereits in Event-Notizen als „Trainer Markus Demo“). */
export const DEMO_STAFF: readonly DemoStaffMember[] = [
  {
    id: DEMO_HEAD_COACH_ID,
    firstName: 'Markus',
    lastName: 'Demo',
    role: 'head_coach',
    aiGenerated: true,
  },
  {
    id: DEMO_CO_TRAINER_ID,
    firstName: 'Sara',
    lastName: 'Demo',
    role: 'co_trainer',
    aiGenerated: true,
  },
] as const;

export function getDemoCoachAvatarUrl(coachId: string | null | undefined): string | null {
  const id = String(coachId ?? '').trim();
  if (id !== DEMO_HEAD_COACH_ID && id !== DEMO_CO_TRAINER_ID) return null;
  return `${DEMO_PLAYER_AVATAR_DIR}/demo-coach-${id}.webp`;
}

export function getDemoStaffMember(coachId: string | null | undefined): DemoStaffMember | undefined {
  const id = String(coachId ?? '').trim();
  return DEMO_STAFF.find((s) => s.id === id);
}

/** Produktives TeamStaffMember-Shape für TeamPage / TrainerStaffCard. */
export function buildDemoStaff(): TeamStaffMember[] {
  return DEMO_STAFF.map((s) => ({
    user_id: s.id,
    role: s.role,
    first_name: s.firstName,
    last_name: s.lastName,
    phone: null,
    email: null,
    avatar_url: getDemoCoachAvatarUrl(s.id),
    cutout_url: null,
  }));
}
