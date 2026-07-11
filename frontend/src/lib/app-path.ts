/** Must match `basePath` in next.config.ts — window.location ignores Next.js basePath. */
export const APP_BASE_PATH = "/pos";

/** Absolute app path for hard navigations (`window.location`). */
export function appHref(path: string): string {
  const normalized = path.startsWith("/") ? path : `/${path}`;
  if (normalized === "/") return `${APP_BASE_PATH}/`;
  return `${APP_BASE_PATH}${normalized}`;
}

/** True when current browser path is this app route (ignores query string). */
export function isAppPath(pathname: string, path: string): boolean {
  const target = (path.startsWith("/") ? path : `/${path}`).split("?")[0] || "/";
  const bare = target === "/" ? APP_BASE_PATH : `${APP_BASE_PATH}${target}`;
  return pathname === bare || pathname === `${bare}/` || pathname.startsWith(`${bare}/`);
}
