export type ReminderCopy = { title: string; message: string };
export type TrainerTrainingContext = {
  ageGroup?: string | null;
  time: string;
  hasMeetingTime: boolean;
  location?: string | null;
};
export type NamedReminderPlayer = { id: string; first_name: string | null; last_name?: string | null };

/** Only guardians in this team receive child names; staff and player accounts keep direct copy. */
export function collectReminderChildNames(
  members: Array<{ user_id: string; role?: string | null }>,
  guardians: Array<{ user_id: string; player_id: string }>,
  eligiblePlayers: NamedReminderPlayer[],
): Map<string, string[]> {
  const parents = new Set(members.filter(m => m.role === 'parent').map(m => m.user_id));
  const staff = new Set(members.filter(m => ['trainer', 'team_admin', 'club_admin', 'admin', 'platform_admin'].includes(m.role ?? '')).map(m => m.user_id));
  const players = new Map(eligiblePlayers.map(p => [p.id, p]));
  const children = new Map<string, Map<string, NamedReminderPlayer>>();
  for (const link of guardians) {
    const player = players.get(link.player_id);
    if (!player || !parents.has(link.user_id) || staff.has(link.user_id)) continue;
    const current = children.get(link.user_id) ?? new Map<string, NamedReminderPlayer>();
    current.set(player.id, player);
    children.set(link.user_id, current);
  }
  return new Map([...children].map(([userId, linked]) => {
    const values = [...linked.values()];
    const names = values.map(p => {
      const first = p.first_name?.trim() ?? '';
      const duplicate = first && values.filter(other => other.first_name?.trim() === first).length > 1;
      return (duplicate ? [first, p.last_name?.trim()].filter(Boolean).join(' ') : first || p.last_name?.trim()) || 'dein Kind';
    }).sort((a, b) => a.localeCompare(b, 'de'));
    return [userId, names];
  }));
}

/** Personalize both inbox and push from the same copy, without changing recipient eligibility. */
export function personalizeReminderCopy(kind: string, copy: ReminderCopy, childNames: string[] = [], trainerContext?: TrainerTrainingContext): ReminderCopy {
  if (kind === 'training' && trainerContext) {
    const group = trainerContext.ageGroup?.trim();
    const location = trainerContext.location?.trim();
    return { ...copy, message: `Heute ${group ? `${group}-Training` : 'Training'} – ${trainerContext.hasMeetingTime ? 'Treffpunkt' : 'Beginn'} ${trainerContext.time} Uhr.${location ? ` Ort: ${location}.` : ''}` };
  }
  if (childNames.length === 0) return copy;
  const label = childNames.length === 1 ? childNames[0] : `${childNames.slice(0, -1).join(', ')} und ${childNames[childNames.length - 1]}`;
  let message = copy.message;
  if (kind === 'training') {
    message = message.replace('Du bist eingeplant – falls du nicht kommen kannst, bitte absagen.',
      childNames.length === 1
        ? `${label} ist eingeplant – falls ${label} nicht kommen kann, bitte absagen.`
        : `${label} sind eingeplant – falls eines der Kinder nicht kommen kann, bitte entsprechend absagen.`);
  } else if (kind === 'match') {
    message = message.replace('Deine Rückmeldung fehlt noch.', `Die Rückmeldung für ${label} fehlt noch.`)
      .replace(/^Bitte für das Spiel am (.*) zu- oder absagen\.$/, (_, when: string) => `Spiel am ${when}: Bitte für ${label} zu- oder absagen.`);
  } else {
    message = message.replace('Treffpunkt nicht vergessen', `Treffpunkt für ${label} nicht vergessen`);
  }
  return { ...copy, message };
}
