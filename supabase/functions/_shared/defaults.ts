// Canonical site URL (used in code-email drafts) and the default
// financials document. Defaults mirror the public dummy figures —
// already visible in the repo, so nothing confidential leaks — and
// keep the "illustrative" caption so unsaved state can't masquerade
// as real numbers.
export const SITE_BASE = 'https://previsiondesign.github.io/gennyspritz';

export const DEFAULT_FINANCIALS = {
  caption: 'Illustrative placeholder figures — full model in the deck',
  years: [
    { label: 'Year 1', marginPct: 58, cases: 5000 },
    { label: 'Year 2', marginPct: 63, cases: 12000 },
    { label: 'Year 3', marginPct: 67, cases: 25000 },
    { label: 'Year 4', marginPct: 70, cases: 48000 },
    { label: 'Year 5', marginPct: 73, cases: 80000 },
  ],
  waterfall: {
    retailPrice: 19.99,
    rows: [
      { label: 'Retailer', amount: 7.0 },
      { label: 'Distributor', amount: 3.4 },
      { label: 'COGS', amount: 3.4 },
      { label: 'Gross profit', amount: 6.19, computed: true },
    ],
  },
  cogs: {
    slices: [
      { label: 'Wine', pct: 30 },
      { label: 'Can', pct: 28 },
      { label: 'Packaging', pct: 16 },
      { label: 'Other', pct: 14 },
      { label: 'Flavor', pct: 12 },
    ],
  },
  benchmarks: {
    rows: [
      { label: 'Hard seltzer avg', pct: 48 },
      { label: 'Premium canned wine', pct: 56 },
      { label: 'genny at launch', pct: 58, highlight: true },
      { label: 'genny at scale', pct: 73, highlight: true },
    ],
  },
};

export function buildCodeEmail(name: string, email: string, code: string) {
  const first = (name || '').trim().split(/\s+/)[0] || 'there';
  return {
    subject: 'Your private access code for genny financials',
    body:
`Hi ${first},

Thank you for your interest in genny. Your private access code is:

    ${code}

View the financials here:
${SITE_BASE}/investors/

Sign in with your email (${email}) and the code above. The code stays
valid until access is closed. These materials are confidential —
please don't forward them.

— Natasha
natashaik@icloud.com · (415) 608-8050`,
  };
}
