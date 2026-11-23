// Dev tracker — fire-and-forget push triggers from the browser. The server reads what happened itself
// (latest result / latest bug event by the caller); the browser only says which record changed.

/** a bug was reported or moved → /api/dev/notify decides who hears about it */
export function notifyBug(bugId: string) {
  fetch('/api/dev/notify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ bugId }),
    keepalive: true,
  }).catch(() => {})
}
