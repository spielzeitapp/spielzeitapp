import React from 'react';
import {PremiumCard} from '../../ui/primitives/PremiumCard';

/** Keep controls and labels outside the photograph so the whole team remains visible. */
export function TeamHeroFrame({photoSrc,photoStyle,className='',children}:{photoSrc?:string|null;photoStyle?:React.CSSProperties;className?:string;children:React.ReactNode}) {
 return <PremiumCard matchday showAmbientGlow className={`${className} !rounded-none !border-x-0 !p-0 overflow-hidden shadow-[0_12px_48px_rgba(0,0,0,0.5)] sm:!rounded-3xl sm:!border-x`}>
  <div data-team-hero-photo className="relative aspect-[16/7] w-full overflow-hidden">
   {photoSrc?<img src={photoSrc} style={photoStyle} alt="Mannschaftsfoto" className="absolute inset-0 h-full w-full object-cover"/>:<div className="absolute inset-0 bg-[linear-gradient(135deg,rgb(var(--club-primary-rgb)/0.65),#09090b)]" aria-hidden/>}
  </div>
  <div data-team-hero-details className="relative z-10 bg-[#08090d] p-4 sm:p-5">{children}</div>
 </PremiumCard>;
}
