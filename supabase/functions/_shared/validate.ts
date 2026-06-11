const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_BODY = 50_000;

export function normEmail(raw: unknown): string | null {
  const e = String(raw ?? '').trim().toLowerCase();
  return EMAIL_RE.test(e) && e.length <= 254 ? e : null;
}

export function str(raw: unknown, max = 500): string {
  return String(raw ?? '').trim().slice(0, max);
}

export async function readJson(req: Request): Promise<Record<string, unknown> | null> {
  try {
    const text = await req.text();
    if (text.length > MAX_BODY) return null;
    const v = JSON.parse(text);
    return v && typeof v === 'object' && !Array.isArray(v) ? v : null;
  } catch {
    return null;
  }
}

function finite(n: unknown): boolean {
  return typeof n === 'number' && Number.isFinite(n);
}

// Lenient structural check for the financials doc (admin-only input,
// but malformed saves would break the investor page render).
export function validFinancials(d: any): boolean {
  try {
    if (!d || typeof d !== 'object') return false;
    if (typeof d.caption !== 'string' || d.caption.length > 240) return false;
    if (!Array.isArray(d.years) || d.years.length < 1 || d.years.length > 10) return false;
    for (const y of d.years) {
      if (typeof y.label !== 'string' || !finite(y.marginPct) || !finite(y.cases)) return false;
    }
    if (!d.waterfall || !finite(d.waterfall.retailPrice)) return false;
    if (!Array.isArray(d.waterfall.rows) || d.waterfall.rows.length < 2 || d.waterfall.rows.length > 8) return false;
    for (const r of d.waterfall.rows) {
      if (typeof r.label !== 'string' || !finite(r.amount)) return false;
    }
    if (!d.cogs || !Array.isArray(d.cogs.slices) || d.cogs.slices.length < 2 || d.cogs.slices.length > 8) return false;
    for (const s of d.cogs.slices) {
      if (typeof s.label !== 'string' || !finite(s.pct)) return false;
    }
    if (!d.benchmarks || !Array.isArray(d.benchmarks.rows) || d.benchmarks.rows.length < 1 || d.benchmarks.rows.length > 8) return false;
    for (const b of d.benchmarks.rows) {
      if (typeof b.label !== 'string' || !finite(b.pct)) return false;
    }
    return true;
  } catch {
    return false;
  }
}
