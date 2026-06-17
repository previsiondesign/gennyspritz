// Investor endpoint: email + code login. A successful call logs one
// view and returns the financials — login-per-visit means revocation
// is instant and every view is recorded.
import { preflight, json } from '../_shared/cors.ts';
import { db, delay } from '../_shared/db.ts';
import { readJson, normEmail } from '../_shared/validate.ts';
import { codesMatch } from '../_shared/codes.ts';
import { DEFAULT_FINANCIALS, computePublicTeaser } from '../_shared/defaults.ts';

Deno.serve(async (req) => {
  const pf = preflight(req);
  if (pf) return pf;

  // Public, no-auth: ONLY the homepage teaser (linked stats + use of capital).
  // Never returns the confidential deck. Powers the main-site investor strip.
  if (req.method === 'GET') {
    const { data } = await db().from('financials').select('doc').eq('id', 1).maybeSingle();
    return json(req, 200, { ok: true, teaser: computePublicTeaser(data?.doc ?? DEFAULT_FINANCIALS) });
  }

  if (req.method !== 'POST') return json(req, 405, { ok: false, reason: 'method' });

  const body = await readJson(req);
  const email = normEmail(body?.email);
  const code = String(body?.code ?? '');
  if (!email || !code) {
    await delay();
    return json(req, 401, { ok: false, reason: 'invalid' });
  }

  const supa = db();
  const { data: inv } = await supa.from('investors')
    .select('email,name,code,status,agreed_at').eq('email', email).maybeSingle();

  if (!inv || !(await codesMatch(inv.code, code))) {
    await delay();
    return json(req, 401, { ok: false, reason: 'invalid' });
  }
  if (inv.status === 'revoked') {
    return json(req, 403, { ok: false, reason: 'revoked' });
  }

  // Terms of access: nothing is shown (or logged as a view) until the
  // investor has accepted, once. Acceptance is recorded with a timestamp.
  if (!inv.agreed_at) {
    if (body?.agree !== true) {
      return json(req, 200, { ok: true, needsAgreement: true, investor: { name: inv.name } });
    }
    await supa.from('investors')
      .update({ agreed_at: new Date().toISOString() }).eq('email', email);
  }

  await supa.from('views').insert({ email });

  const { data: fin } = await supa.from('financials')
    .select('doc,updated_at').eq('id', 1).maybeSingle();

  return json(req, 200, {
    ok: true,
    investor: { name: inv.name },
    financials: fin?.doc ?? DEFAULT_FINANCIALS,
    updatedAt: fin?.updated_at ?? null,
  });
});
