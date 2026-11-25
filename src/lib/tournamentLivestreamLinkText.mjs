import { tournamentLivestreamEmbedUrl, tournamentLivestreamUrl } from '../../server/lib/tournamentLivestream.js';

export function tournamentLivestreamLinksInText(text) {
  const candidates = text.matchAll(/(?:^|[\s<('“"„])((?:https:\/\/|www\.|(?:m\.)?youtube\.com\/|youtu\.be\/)[^\s<>"“”'«»\[\]{}]+)/gi);
  const links = new Set();
  for (const [, candidate] of candidates) {
    if (/(?:…|\.{3})/.test(candidate)) continue;
    const address = candidate.replace(/[.,;!?)]+$/, '');
    const url = tournamentLivestreamUrl(/^https:\/\//i.test(address) ? address : `https://${address}`);
    if (!url) continue;
    const parsed = new URL(url);
    if (!/^(?:[a-z\d](?:[a-z\d-]*[a-z\d])?\.)+[a-z\d-]{2,}$/i.test(parsed.hostname)) continue;
    if (/(^|\.)youtube\.com$|^youtu\.be$/i.test(parsed.hostname) && !tournamentLivestreamEmbedUrl(url)) continue;
    links.add(url);
  }
  return [...links];
}
