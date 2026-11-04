/** Route external ÖFB portraits through the existing bounded same-origin image endpoint.
 * Stored URLs and storage/blob/demo sources remain unchanged.
 */
export function playerPhotoDisplayUrl(src?:string|null):string {
 const value=(src??'').trim();
 if(!value)return '';
 try {const url=new URL(value);const staffPhoto=url.pathname.match(/^\/oefb2\/images\/1278650591628556536_([a-f0-9]{20})-1,0-400x400-400x400\.png$/i);if(url.protocol==='https:'&&url.host==='www.oefb.at'&&staffPhoto)return '/api/oefb/table?view=staffPhoto&id='+staffPhoto[1].toLowerCase();if(url.protocol==='https:'&&url.host==='vereine.oefb.at'&&url.pathname.startsWith('/netzwerk/imagedownload/'))return '/api/oefb/table?view=photo&quality=portrait&url='+encodeURIComponent(value);}catch{/* Relative and blob sources are valid display inputs. */}
 return value;
}

// Reviewed, background-only edit of this exact public ÖFB photo; a new source URL bypasses it.
const PREPARED_SOURCE = 'https://vereine.oefb.at/netzwerk/imagedownload/670725461856634215_1946784381171732381-80-80-KuMLNQuJ.jpg';
export const PREPARED_PORTRAIT = '/profile/melk-portrait-9755193-v1.webp';
export function preparedPlayerPortrait(src?: string | null): string | null {
  return (src ?? '').trim() === PREPARED_SOURCE ? PREPARED_PORTRAIT : null;
}
export function isImportedPlayerPortrait(src?: string | null): boolean {
  const display = playerPhotoDisplayUrl(src);
  return display.startsWith('/api/oefb/table?view=photo&');
}
