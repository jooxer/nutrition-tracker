// Parse a food spec string and extract the gram weight that one unit represents.
// Examples:
//   "100g"       -> 100
//   "30g/片"     -> 30
//   "100克"      -> 100
//   "一份"       -> 100 (default fallback)
//   "500ml"      -> 500 (treat ml as g for liquids)
export function parseSpecGrams(spec: string): number {
  if (!spec) return 100;
  const m = spec.match(/(\d+(?:\.\d+)?)\s*(?:g|克|ml|毫升)/i);
  if (m) return Number(m[1]);
  return 100;
}
