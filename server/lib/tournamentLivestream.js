export const TOURNAMENT_LIVESTREAM_POST = 'tournament_livestream';

export function tournamentLivestreamUrl(value) {
  if (typeof value !== 'string' || value.length > 2048) return null;
  try {
    const url = new URL(value.trim());
    return url.protocol === 'https:' && !url.username && !url.password ? url.href : null;
  } catch {
    return null;
  }
}

export function tournamentLivestreamEmbedUrl(value) {
  const safeUrl = tournamentLivestreamUrl(value);
  if (!safeUrl) return null;
  const url = new URL(safeUrl);
  if (url.port) return null;

  const cloudflareHost = /^customer-[a-z0-9]+\.cloudflarestream\.com$/.test(url.hostname)
    || url.hostname === 'iframe.videodelivery.net';
  const cloudflareVideo = /^\/([a-f0-9]{32}|[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+)\/iframe\/?$/.exec(url.pathname);
  if (cloudflareHost && cloudflareVideo) {
    return new URL(`/${cloudflareVideo[1]}/iframe?autoplay=true`, url.origin).href;
  }

  const shortLink = url.hostname === 'youtu.be';
  const youtubeHost = url.hostname === 'youtube.com' || url.hostname === 'www.youtube.com'
    || url.hostname === 'm.youtube.com';
  const privacyHost = url.hostname === 'www.youtube-nocookie.com';
  const videoId = shortLink ? /^\/([^/]+)\/?$/.exec(url.pathname)?.[1]
    : youtubeHost && url.pathname === '/watch' ? url.searchParams.get('v')
    : youtubeHost || privacyHost ? /^\/(?:embed|live)\/([^/]+)\/?$/.exec(url.pathname)?.[1]
    : null;
  if (videoId && /^[A-Za-z0-9_-]{11}$/.test(videoId)) {
    return `https://www.youtube-nocookie.com/embed/${videoId}?autoplay=1&playsinline=1`;
  }
  return null;
}
