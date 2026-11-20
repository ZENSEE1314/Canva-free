// Where Artvas is running. The claude.ai preview runs Artvas inside a locked-down frame that
// blocks downloads from other sites (AI models, voices, fonts' CDNs) and has no Artvas server.
export const inPreview = (() => {
  try {
    if (/claudeusercontent\.com$|claude\.ai$/.test(location.hostname)) return true;
    return window.self !== window.top;
  } catch {
    return true;
  }
})();

/**
 * The message to show when something needs downloads or the Artvas server.
 * what: e.g. "Auto captions", "This voice".
 */
export function needsSite(what, fallback) {
  return inPreview
    ? `${what} can't run in this claude.ai preview — it blocks the AI download. Open your own Artvas site (your Railway link) and it works there.`
    : fallback;
}
