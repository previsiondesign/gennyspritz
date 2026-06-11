// Founder endpoint — every action behind the x-admin-key gate.
// Routes: /admin/overview (GET), /admin/financials (GET|PUT),
// /admin/grant /admin/revoke /admin/regenerate /admin/dismiss (POST).
import { preflight, json } from '../_shared/cors.ts';
import { db, clientIp, delay } from '../_shared/db.ts';
import { readJson, normEmail, str, validFinancials } from '../_shared/validate.ts';
import { generateCode, codesMatch } from '../_shared/codes.ts';
import { DEFAULT_FINANCIALS, buildCodeEmail } from '../_shared/defaults.ts';

const FAIL_WINDOW_MIN = 10;
const FAIL_LIMIT = 20;

async function requireAdmin(req: Request): Promise<Response | null> {
  const supa = db();
  const ip = clientIp(req);
  const given = req.headers.get('x-admin-key') ?? '';
  const expected = Deno.env.get('ADMIN_PASSCODE') ?? '';

  // lockout check (best-effort, table-backed)
  const since = new Date(Date.now() - FAIL_WINDOW_MIN * 60_000).toISOString();
  const { count } = await supa.from('auth_failures')
    .select('id', { count: 'exact', head: true })
    .eq('ip', ip).gte('at', since);
  if ((count ?? 0) >= FAIL_LIMIT) {
    return json(req, 429, { ok: false, reason: 'locked' });
  }

  if (!expected || !(await codesMatch(expected, given))) {
    await supa.from('auth_failures').insert({ ip });
    if (Math.random() < 0.1) {
      await supa.from('auth_failures').delete()
        .lt('at', new Date(Date.now() - 3_600_000).toISOString());
    }
    await delay();
    return json(req, 401, { ok: false, reason: 'unauthorized' });
  }
  return null;
}

Deno.serve(async (req) => {
  const pf = preflight(req);
  if (pf) return pf;

  const denied = await requireAdmin(req);
  if (denied) return denied;

  const supa = db();
  const action = new URL(req.url).pathname.split('/').filter(Boolean).pop();

  // ---------- overview ----------
  if (action === 'overview' && req.method === 'GET') {
    const [{ data: requests }, { data: investors }, { data: views }] = await Promise.all([
      supa.from('requests').select('*').order('created_at', { ascending: false }).limit(500),
      supa.from('investors').select('*').order('created_at', { ascending: false }),
      supa.from('views').select('email,viewed_at').order('viewed_at', { ascending: false }).limit(5000),
    ]);
    const byEmail: Record<string, string[]> = {};
    for (const v of views ?? []) (byEmail[v.email] ??= []).push(v.viewed_at);
    const inv = (investors ?? []).map((i) => ({
      ...i,
      viewCount: byEmail[i.email]?.length ?? 0,
      lastViewAt: byEmail[i.email]?.[0] ?? null,
      views: byEmail[i.email] ?? [],
    }));
    const status: Record<string, string> = {};
    for (const i of inv) status[i.email] = i.status;
    const reqs = (requests ?? []).map((r) => ({
      ...r,
      investorStatus: status[r.email] ?? 'none',
    }));
    return json(req, 200, { ok: true, requests: reqs, investors: inv });
  }

  // ---------- financials ----------
  if (action === 'financials' && req.method === 'GET') {
    const { data } = await supa.from('financials').select('doc,updated_at').eq('id', 1).maybeSingle();
    return json(req, 200, {
      ok: true,
      financials: data?.doc ?? DEFAULT_FINANCIALS,
      isDefault: !data,
      updatedAt: data?.updated_at ?? null,
    });
  }
  if (action === 'financials' && req.method === 'PUT') {
    const body = await readJson(req);
    if (!body || !validFinancials(body)) return json(req, 400, { ok: false, reason: 'bad-shape' });
    const { error } = await supa.from('financials')
      .upsert({ id: 1, doc: body, updated_at: new Date().toISOString() });
    if (error) return json(req, 500, { ok: false, reason: 'store' });
    return json(req, 200, { ok: true });
  }

  if (req.method !== 'POST') return json(req, 405, { ok: false, reason: 'method' });
  const body = await readJson(req);
  if (!body) return json(req, 400, { ok: false, reason: 'bad-json' });

  // ---------- grant (by requestId, or manual email/name) ----------
  if (action === 'grant') {
    let email: string | null, name = '', firm = '';
    const requestId = str(body.requestId, 60);
    if (requestId) {
      const { data: r } = await supa.from('requests').select('*').eq('id', requestId).maybeSingle();
      if (!r) return json(req, 404, { ok: false, reason: 'no-request' });
      email = normEmail(r.email); name = r.name ?? ''; firm = r.firm ?? '';
    } else {
      email = normEmail(body.email);
      name = str(body.name, 120); firm = str(body.firm, 160);
    }
    if (!email) return json(req, 400, { ok: false, reason: 'bad-email' });

    const { data: existing } = await supa.from('investors').select('*').eq('email', email).maybeSingle();
    // idempotent on active; NEW code when re-granting a revoked investor
    const code = existing?.status === 'active' ? existing.code : generateCode();
    const now = new Date().toISOString();
    const { error } = await supa.from('investors').upsert({
      email,
      name: name || existing?.name || '',
      firm: firm || existing?.firm || '',
      code,
      status: 'active',
      updated_at: now,
      revoked_at: null,
      request_id: requestId || existing?.request_id || null,
      created_at: existing?.created_at ?? now,
    });
    if (error) return json(req, 500, { ok: false, reason: 'store' });
    if (requestId) {
      await supa.from('requests').update({ status: 'granted', handled_at: now }).eq('id', requestId);
    }
    return json(req, 200, {
      ok: true,
      investor: { email, name, code },
      emailDraft: buildCodeEmail(name, email, code),
    });
  }

  // ---------- revoke ----------
  if (action === 'revoke') {
    const email = normEmail(body.email);
    if (!email) return json(req, 400, { ok: false, reason: 'bad-email' });
    const now = new Date().toISOString();
    const { error } = await supa.from('investors')
      .update({ status: 'revoked', revoked_at: now, updated_at: now }).eq('email', email);
    if (error) return json(req, 500, { ok: false, reason: 'store' });
    return json(req, 200, { ok: true });
  }

  // ---------- regenerate (active investors only) ----------
  if (action === 'regenerate') {
    const email = normEmail(body.email);
    if (!email) return json(req, 400, { ok: false, reason: 'bad-email' });
    const { data: inv } = await supa.from('investors').select('*').eq('email', email).maybeSingle();
    if (!inv) return json(req, 404, { ok: false, reason: 'no-investor' });
    if (inv.status !== 'active') return json(req, 409, { ok: false, reason: 'revoked' });
    const code = generateCode();
    const { error } = await supa.from('investors')
      .update({ code, updated_at: new Date().toISOString() }).eq('email', email);
    if (error) return json(req, 500, { ok: false, reason: 'store' });
    return json(req, 200, {
      ok: true, code,
      emailDraft: buildCodeEmail(inv.name, email, code),
    });
  }

  // ---------- dismiss request ----------
  if (action === 'dismiss') {
    const requestId = str(body.requestId, 60);
    if (!requestId) return json(req, 400, { ok: false, reason: 'bad-id' });
    const { error } = await supa.from('requests')
      .update({ status: 'dismissed', handled_at: new Date().toISOString() }).eq('id', requestId);
    if (error) return json(req, 500, { ok: false, reason: 'store' });
    return json(req, 200, { ok: true });
  }

  return json(req, 404, { ok: false, reason: 'unknown-action' });
});
