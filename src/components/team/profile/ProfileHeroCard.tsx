import React from 'react';
import type {PlayerPhotoLayout} from '../../../lib/playerPhotoLayout';
import type {ProfilePositionBadge} from '../../../lib/positionLabels';
import {TrainerProfileHeroCard} from './TrainerProfileHeroCard';

/**
 * Profil-Hero Router — einheitliche Premium-Card für Trainer + Spieler.
 */

export type ProfileHeroVariant = "trainer" | "player";

type Props = {
  photoLayout?:PlayerPhotoLayout|null;
  variant: ProfileHeroVariant;
  watermark: string;
  firstNameLine: string;
  lastNameLine: string;
  teamSeasonLabel: string;
  teamName?: string | null;
  teamLogoUrl?: string | null;
  roleLabel?: string | null;
  photoUrl?: string | null;
  cutoutUrl?: string | null;
  initials: string;
  showTacticalBoard?: boolean;
  positionBadge?: ProfilePositionBadge | null;
  statusSlot?: React.ReactNode;
};

/** One profile composition for players and trainers, including edited portraits. */
export const ProfileHeroCard: React.FC<Props> = (props) => {
 const {variant:_variant,...portraitProps}=props;
 return <TrainerProfileHeroCard {...portraitProps}/>;
};
