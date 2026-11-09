/** Separate same-origin workspace. Existing /manager routes keep their UI. */
export const MANAGER_COMPARISON_BASE = '/vereinszentrale';
export function isManagerComparisonPath(pathname: string): boolean {
  return pathname === MANAGER_COMPARISON_BASE || pathname.startsWith(MANAGER_COMPARISON_BASE + '/');
}
export function isManagerComparison(): boolean {
  return typeof window !== 'undefined' && isManagerComparisonPath(window.location?.pathname ?? '');
}
/** React Router handles its basename. Use this only for full-document navigation. */
export function managerComparisonHref(path: string, currentPath = typeof window !== 'undefined' ? window.location.pathname : ''): string {
  if (!isManagerComparisonPath(currentPath) || !path.startsWith('/') || path.startsWith('//') || isManagerComparisonPath(path.split(/[?#]/)[0])) return path;
  return MANAGER_COMPARISON_BASE + path;
}

/** Shared tools stay within the central shell; deliberately external app links remain explicit. */
export function managerToolPath(path:string, currentPath=typeof window!=='undefined'?window.location.pathname:''):string {
  if(!isManagerComparisonPath(currentPath))return path;
  if(!/^\/app\/(home|termine|team|events|match|match-preparation|match-lineup|live|spielplan|tabelle|nachrichten|mehr)(?=[/?#]|$)/.test(path))return path;
  return path.replace(/^\/app\//,'/manager/');
}
