/** Shared helpers for interview template structure (stored as JSON, edited via UI). */

export function normalizeFields(structure) {
  if (!structure) return []
  if (Array.isArray(structure)) return structure
  if (Array.isArray(structure.fields)) return structure.fields
  return []
}

export function slugifyLabel(label) {
  const s = String(label || '').trim().toLowerCase()
  const slug = s.replace(/[^a-z0-9]+/g, '_').replace(/^_|_$/g, '')
  return slug || 'field'
}

/** Build unique keys from user field rows { label, type } */
export function buildStructureFromRows(rows) {
  const used = new Set()
  const fields = rows
    .filter((r) => String(r.label || '').trim())
    .map((r, i) => {
      let key = slugifyLabel(r.label)
      const base = key
      let n = 0
      while (used.has(key)) {
        n += 1
        key = `${base}_${n}`
      }
      used.add(key)
      return {
        key,
        type: r.type === 'text' || r.type === 'textarea' ? r.type : 'rating',
        label: String(r.label).trim(),
      }
    })
  return { fields }
}
