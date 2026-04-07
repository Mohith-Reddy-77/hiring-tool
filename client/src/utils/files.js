/** Maps a stored path like `uploads/xyz.pdf` to a browser URL (dev: proxied `/files/...`). */
export function fileUrl(storedPath) {
  if (!storedPath) return '#'
  const normalized = String(storedPath).replace(/\\/g, '/').replace(/^uploads\//, '')
  return `/files/${normalized}`
}
