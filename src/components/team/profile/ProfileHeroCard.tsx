import React from 'react';
import type {ClubProfileDesign} from '../../../lib/clubProfileDesign';
import {ClubProfileOverlay} from './ClubProfileOverlay';
import type {PlayerPhotoLayout} from '../../../lib/playerPhotoLayout';
import type {ProfilePositionBadge} from '../../../lib/positionLabels';
import {PlayerPortraitCanvas} from '../PlayerPortraitCanvas';
import {DEFAULT_PHOTO_LAYOUT} from '../../../lib/playerPhotoLayout';
import {isImportedPlayerPortrait,preparedPlayerPortrait} from '../../../lib/playerPhotoDisplay';
import {TrainerProfileHeroCard} from './TrainerProfileHeroCard';

/**
 * Profil-Hero: Vereinsfotos im gemeinsamen Canvas, Freisteller und Trainer im Premium-Layout.
 */

export type ProfileHeroVariant = "trainer" | "player";

type Props = {
  onDesignChange?:(design:ClubProfileDesign)=>void;
  clubDesign?:ClubProfileDesign|null;
  clubTemplate?: 'wide' | 'square';
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

/** Imported artwork uses the same saved canvas as the roster and Manager preview. */
export const ProfileHeroCard: React.FC<Props> = (props) => {
 const {variant,clubTemplate,clubDesign,onDesignChange,...portraitProps}=props;
 // Player artwork must use exactly the same canvas as the roster and Manager.
 // Imported portraits already contain their club background and crest.
 const decorate=(card:React.ReactNode)=>clubDesign&&variant==='player'?<div className="relative">{card}<ClubProfileOverlay onChange={onDesignChange} design={clubDesign} first={props.firstNameLine} last={props.lastNameLine} number={props.watermark} team={props.teamName} season={props.teamSeasonLabel} logo={props.teamLogoUrl}/></div>:card;
 const originalSource = props.photoLayout ? props.photoLayout.source === 'original' : !props.cutoutUrl;
 const imported = originalSource && ((props.photoLayout && isImportedPlayerPortrait(props.photoUrl)) || preparedPlayerPortrait(props.photoUrl));
 if (variant === 'player' && (clubTemplate === 'square' || (!clubTemplate && imported))) {
   const layout = props.photoLayout ?? DEFAULT_PHOTO_LAYOUT;
   return decorate(<div className="sz-club-profile-hero sz-club-imported-portrait relative mb-3 aspect-square w-full overflow-hidden rounded-[22px] border" data-profile-artwork="player-canvas">
     <PlayerPortraitCanvas hideDecorations={Boolean(clubDesign)} layout={layout} photoUrl={props.photoUrl} cutoutUrl={props.cutoutUrl} firstName={props.firstNameLine} lastName={props.lastNameLine} number={props.watermark} />
     {props.statusSlot}
   </div>);
 }
 return decorate(<TrainerProfileHeroCard {...portraitProps} hideDecorations={Boolean(clubDesign)&&variant==='player'}/>);
};
