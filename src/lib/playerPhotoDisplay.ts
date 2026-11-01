/** Route external ÖFB portraits through the existing bounded same-origin image endpoint.
 * Stored URLs and storage/blob/demo sources remain unchanged.
 */
export function playerPhotoDisplayUrl(src?:string|null):string {
 const value=(src??'').trim();
 if(!value)return '';
 try {const url=new URL(value);if(url.protocol==='https:'&&url.host==='vereine.oefb.at'&&url.pathname.startsWith('/netzwerk/imagedownload/'))return '/api/oefb/table?view=photo&quality=portrait&url='+encodeURIComponent(value);}catch{/* Relative and blob sources are valid display inputs. */}
 return value;
}
