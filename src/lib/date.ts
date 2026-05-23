function pad2(n: number): string { return String(n).padStart(2, '0'); }

export function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

export function monthRange(yyyymm: string): string[] {
  const [y, m] = yyyymm.split('-').map(Number);
  const last = new Date(y, m, 0).getDate();
  const out: string[] = [];
  for (let day = 1; day <= last; day++) out.push(`${y}-${pad2(m)}-${pad2(day)}`);
  return out;
}

export function addDays(key: string, delta: number): string {
  const [y, m, d] = key.split('-').map(Number);
  const dt = new Date(y, m - 1, d + delta);
  return `${dt.getFullYear()}-${pad2(dt.getMonth() + 1)}-${pad2(dt.getDate())}`;
}

const WEEK_LABELS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六'];

export function friendlyDate(key: string): string {
  const [y, m, d] = key.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  const today = todayKey();
  if (key === today) return `今天 · ${WEEK_LABELS[dt.getDay()]}`;
  if (key === addDays(today, -1)) return `昨天 · ${WEEK_LABELS[dt.getDay()]}`;
  return `${m}月${d}日 · ${WEEK_LABELS[dt.getDay()]}`;
}
