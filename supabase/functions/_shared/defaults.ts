// Canonical site URL (used in email links/drafts) and the default
// financials document (v2 layout). Defaults are ILLUSTRATIVE placeholder
// figures only — the real numbers live solely in the database (entered or
// seeded via the dashboard API) and never in this public repo.
export const SITE_BASE = 'https://gennyspritz.com';

export const DEFAULT_FINANCIALS = {
  v: 2,
  caption: 'Illustrative placeholder figures — full model in the deck',
  topStats: {
    title: '',
    items: [
      { label: 'Retail price', value: '$19.99', sub: 'per 4-pack at shelf' },
      { label: 'FOB / producer price', value: '$9.00', sub: 'after dist. + retail margins' },
      { label: 'Total COGS', value: '$3.50', sub: 'per 4-pack' },
      { label: 'Gross margin', value: '58.0%', sub: 'on FOB · $5.50 / 4-pack', highlight: true },
    ],
  },
  years: {
    items: [
      { label: 'Launch · Y1', marginPct: 58.0, cases: 5000, revenue: '$250K revenue', delta: 'Baseline' },
      { label: 'Year 2', marginPct: 63.0, cases: 12000, revenue: '$700K revenue', delta: '+5.0 pts' },
      { label: 'Year 3', marginPct: 67.0, cases: 25000, revenue: '$1.5M revenue', delta: '+9.0 pts' },
      { label: 'Year 4', marginPct: 70.0, cases: 48000, revenue: '$3.0M revenue', delta: '+12.0 pts' },
      { label: 'Year 5', marginPct: 73.0, cases: 80000, revenue: '$5.0M revenue', delta: '+15.0 pts' },
    ],
  },
  narrative: {
    title: '',
    paragraphs: [
      'Illustrative placeholder narrative — open the editor to replace this with the real story behind the numbers.',
    ],
  },
  waterfall: {
    title: 'Price waterfall per 4-pack',
    retailPrice: 19.99,
    rows: [
      { label: 'Retailer', amount: 7.0 },
      { label: 'Distributor', amount: 3.4 },
      { label: 'COGS', amount: 3.5 },
      { label: 'Gross profit', amount: 6.09, computed: true },
    ],
  },
  cogs: {
    title: 'COGS breakdown per can',
    slices: [
      { label: 'Wine', pct: 30.0 },
      { label: 'Can', pct: 28.0 },
      { label: 'Packaging', pct: 16.0 },
      { label: 'Other', pct: 14.0 },
      { label: 'Flavor', pct: 12.0 },
    ],
  },
  benchmarks: {
    title: 'Gross margin vs. category benchmarks',
    rows: [
      { label: 'Hard seltzer avg', pct: 48.0 },
      { label: 'Premium canned wine avg', pct: 56.0 },
      { label: 'genny at launch', pct: 58.0, highlight: true },
      { label: 'genny at scale (target)', pct: 73.0, highlight: true },
    ],
  },
  evolution: {
    title: 'Revenue, cost, and margin evolution',
    sub: 'Per 4-pack · FOB basis',
    rows: [
      { label: 'Y1 · Launch', fob: 9.0, cogs: 3.5, marginPct: 58.0 },
      { label: 'Y2', fob: 9.4, cogs: 3.4, marginPct: 63.0 },
      { label: 'Y3', fob: 9.8, cogs: 3.2, marginPct: 67.0 },
      { label: 'Y4', fob: 10.1, cogs: 3.1, marginPct: 70.0 },
      { label: 'Y5', fob: 10.5, cogs: 2.9, marginPct: 73.0 },
    ],
  },
  costCompress: {
    title: 'Where costs compress',
    sub: 'COGS composition per 4-pack',
    components: ['Can + lid', 'Co-pack + sleeve', 'Liquid inputs', 'Carrier', 'Compliance'],
    rows: [
      { label: 'Y1 · Launch', values: [1.1, 1.2, 0.8, 0.05, 0.35] },
      { label: 'Y2', values: [1.05, 1.1, 0.78, 0.05, 0.42] },
      { label: 'Y3', values: [1.0, 1.0, 0.75, 0.05, 0.4] },
      { label: 'Y4', values: [0.95, 0.9, 0.73, 0.05, 0.47] },
      { label: 'Y5', values: [0.9, 0.8, 0.7, 0.05, 0.45] },
    ],
  },
  assumptions: {
    title: 'Model assumptions',
    rows: [
      { label: 'Liquid formula', value: 'illustrative — edit me' },
      { label: 'Bulk wine ($/gal)', value: '$3.00 → $2.50' },
      { label: 'Aluminum can', value: '$0.28 → $0.22' },
      { label: 'Volume (cases)', value: '5,000 → 80,000' },
    ],
  },
};

export function buildCodeEmail(name: string, email: string, code: string) {
  const first = (name || '').trim().split(/\s+/)[0] || 'there';
  return {
    subject: 'Your private access code for genny financials',
    body:
`Hi ${first},

Thank you for your interest in genny!

I've granted you access to our financial data. Your personal code is:

${code}

View the financials here:
${SITE_BASE}/investors/

Sign in with your email (${email}) and the code above.
Note: These materials are confidential — please don't forward or share them without permission.

Natasha
natasha@gennyspritz.com
(415) 608-8050`,
  };
}
