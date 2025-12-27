export function isInternalUrl(url: string): boolean {
  if (!url) return false;

  return [
    "chrome-extension://",
    "moz-extension://",
    "safari-extension://",
    "chrome://",
    "brave://",
    "edge://",
    "about:",
  ].some((scheme) => url.startsWith(scheme));
}
