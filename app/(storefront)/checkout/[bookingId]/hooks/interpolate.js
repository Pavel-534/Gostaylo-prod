export function interpolateTemplate(str, vars = {}) {
  let s = String(str)
  for (const [k, v] of Object.entries(vars)) {
    s = s.split(`{{${k}}}`).join(String(v))
  }
  return s
}
