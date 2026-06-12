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

// Lenient structural check for the financials doc v2 (admin-only input,
// but malformed saves would break the investor page render). Sections are
// optional; whatever is present must be shaped sanely.
const strOk = (s: unknown, max = 300) => typeof s === 'string' && s.length <= max;
const listOk = (a: unknown, max = 24) => Array.isArray(a) && a.length >= 1 && a.length <= max;

export function validFinancials(d: any): boolean {
  try {
    if (!d || typeof d !== 'object') return false;
    if (!strOk(d.caption, 240)) return false;
    if (d.topStats) {
      if (!strOk(d.topStats.title) || !listOk(d.topStats.items)) return false;
      for (const s of d.topStats.items) {
        if (!strOk(s.label) || !strOk(s.value, 60) || !strOk(s.sub ?? '')) return false;
      }
    }
    if (!d.years || !listOk(d.years.items, 12)) return false;
    for (const y of d.years.items) {
      if (!strOk(y.label) || !finite(y.marginPct) || !finite(y.cases) ||
          !strOk(y.revenue ?? '') || !strOk(y.delta ?? '')) return false;
    }
    if (d.narrative) {
      if (!strOk(d.narrative.title) || !Array.isArray(d.narrative.paragraphs) ||
          d.narrative.paragraphs.length > 8) return false;
      for (const p of d.narrative.paragraphs) if (!strOk(p, 1200)) return false;
    }
    if (d.waterfall) {
      if (!strOk(d.waterfall.title) || !finite(d.waterfall.retailPrice) || !listOk(d.waterfall.rows, 10)) return false;
      for (const r of d.waterfall.rows) if (!strOk(r.label) || !finite(r.amount)) return false;
    }
    if (d.cogs) {
      if (!strOk(d.cogs.title) || !listOk(d.cogs.slices, 12)) return false;
      for (const s of d.cogs.slices) if (!strOk(s.label) || !finite(s.pct)) return false;
    }
    if (d.benchmarks) {
      if (!strOk(d.benchmarks.title) || !listOk(d.benchmarks.rows, 12)) return false;
      for (const b of d.benchmarks.rows) if (!strOk(b.label) || !finite(b.pct)) return false;
    }
    if (d.evolution) {
      if (!strOk(d.evolution.title) || !strOk(d.evolution.sub ?? '') || !listOk(d.evolution.rows, 12)) return false;
      for (const r of d.evolution.rows) {
        if (!strOk(r.label) || !finite(r.fob) || !finite(r.cogs) || !finite(r.marginPct)) return false;
      }
    }
    if (d.costCompress) {
      const c = d.costCompress;
      if (!strOk(c.title) || !strOk(c.sub ?? '') || !listOk(c.components, 10) || !listOk(c.rows, 12)) return false;
      for (const comp of c.components) if (!strOk(comp)) return false;
      for (const r of c.rows) {
        if (!strOk(r.label) || !Array.isArray(r.values) || r.values.length !== c.components.length) return false;
        for (const v of r.values) if (!finite(v)) return false;
      }
    }
    if (d.assumptions) {
      if (!strOk(d.assumptions.title) || !listOk(d.assumptions.rows, 24)) return false;
      for (const r of d.assumptions.rows) if (!strOk(r.label) || !strOk(r.value)) return false;
    }
    return true;
  } catch {
    return false;
  }
}
