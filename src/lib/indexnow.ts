const INDEXNOW_KEY = "f94b94b90dc243f2832bfd76962a215d";
const SITE_URL = process.env.APP_URL ?? "https://salutebutton.com";

/**
 * Ping IndexNow to notify search engines about new or updated URLs.
 * Runs in the background — never blocks the request.
 */
export function pingIndexNow(paths: string[]) {
  if (!paths.length) return;

  const urlList = paths.map((p) =>
    p.startsWith("http") ? p : `${SITE_URL}${p.startsWith("/") ? p : `/${p}`}`
  );

  const payload = {
    host: new URL(SITE_URL).hostname,
    key: INDEXNOW_KEY,
    urlList,
  };

  fetch("https://api.indexnow.org/indexnow", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  }).catch(() => {
    // Silently fail — IndexNow is best-effort, should never break the app
  });
}
