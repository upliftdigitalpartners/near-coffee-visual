/**
 * Is there really a file at this path?
 *
 * `response.ok` is not the answer, and the reason is a trap that only springs
 * in production. `netlify.toml` rewrites `/*` to `/index.html` with status
 * **200** — the ordinary single-page-app catch-all, and the thing that makes
 * every route serve the app. It also means a request for a file that does not
 * exist comes back 200 with the page's own HTML in the body. The dev server
 * aborts the same request, so locally the probe looks like it works.
 *
 * Both of this project's optional clips are expected to be missing. Checked
 * with `ok` alone, every visitor to the deployed site would have been handed
 * an HTML document to decode as video.
 *
 * So the content type is what gets checked. A real mp4 answers `video/mp4`;
 * the catch-all answers `text/html`.
 */
export async function present(url: string, kind: 'video' | 'image' | 'audio'): Promise<boolean> {
  try {
    const r = await fetch(url, { method: 'HEAD' })
    if (!r.ok) return false
    return (r.headers.get('content-type') ?? '').startsWith(`${kind}/`)
  } catch {
    return false
  }
}
