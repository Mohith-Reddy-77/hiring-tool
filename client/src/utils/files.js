/** Maps a stored path like `uploads/xyz.pdf` to a browser URL (dev: proxied `/files/...`). */
export function fileUrl(storedPath) {
  if (!storedPath) return '#'
  const sp = String(storedPath)
  // If an absolute URL already (signed/public URL), return as-is
  if (/^https?:\/\//i.test(sp)) return sp
  const normalized = sp.replace(/\\/g, '/').replace(/^uploads\//, '')
  return `/files/${normalized}`
}
