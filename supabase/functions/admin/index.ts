// Founder endpoint — every action behind the x-admin-key gate.
// Routes: /admin/overview (GET), /admin/financials (GET|PUT),
// /admin/grant /admin/revoke /admin/regenerate /admin/dismiss (POST).
import { preflight, json } from '../_shared/cors.ts';
import { db, clientIp, delay } from '../_shared/db.ts';
import { readJson, normEmail, str, validFinancials } from '../_shared/validate.ts';
import { generateCode, sha256Hex } from '../_shared/codes.ts';
import { DEFAULT_FINANCIALS, buildCodeEmail } from '../_shared/defaults.ts';
import { sendEmail } from '../_shared/email.ts';

const FAIL_WINDOW_MIN = 10;
const FAIL_LIMIT = 20;

// Stored passcode hash: DB row wins (changeable from the dashboard);
// the ADMIN_PASSCODE env secret is only a bootstrap fallback.
async function storedPasscodeHash(supa: ReturnType<typeof db>): Promise<string | null> {
  const { data } = await supa.from('admin_settings')
    .select('passcode_hash').eq('id', 1).maybeSingle();
  if (data?.passcode_hash) return data.passcode_hash;
  const env = Deno.env.get('ADMIN_PASSCODE');
  return env ? await sha256Hex(env) : null;
}

async function passcodeValid(supa: ReturnType<typeof db>, given: string): Promise<boolean> {
  const stored = await storedPasscodeHash(supa);
  if (!stored || !given) return false;
  const givenHash = await sha256Hex(given);
  let diff = 0;
  for (let i = 0; i < stored.length; i++) diff |= stored.charCodeAt(i) ^ (givenHash.charCodeAt(i) ?? 0);
  return diff === 0 && stored.length === givenHash.length;
}

async function requireAdmin(req: Request): Promise<Response | null> {
  const supa = db();
  const ip = clientIp(req);
  const given = req.headers.get('x-admin-key') ?? '';

  // lockout check (best-effort, table-backed)
  const since = new Date(Date.now() - FAIL_WINDOW_MIN * 60_000).toISOString();
  const { count } = await supa.from('auth_failures')
    .select('id', { count: 'exact', head: true })
    .eq('ip', ip).gte('at', since);
  if ((count ?? 0) >= FAIL_LIMIT) {
    return json(req, 429, { ok: false, reason: 'locked' });
  }

  if (!(await passcodeValid(supa, given))) {
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
    const [{ data: requests }, { data: investors }, { data: views }, { data: launchList }, { data: bugs }] = await Promise.all([
      supa.from('requests').select('*').order('created_at', { ascending: false }).limit(500),
      supa.from('investors').select('*').order('created_at', { ascending: false }),
      supa.from('views').select('email,viewed_at').order('viewed_at', { ascending: false }).limit(5000),
      supa.from('launch_list').select('*').order('created_at', { ascending: false }).limit(2000),
      supa.from('bug_reports').select('*').order('created_at', { ascending: false }).limit(200),
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
    return json(req, 200, {
      ok: true, requests: reqs, investors: inv,
      launchList: launchList ?? [], bugs: bugs ?? [],
      emailEnabled: !!Deno.env.get('RESEND_API_KEY'),
    });
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
    const sameCode = existing?.status === 'active';
    const code = sameCode ? existing.code : generateCode();
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
      // a fresh code hasn't been emailed yet; an unchanged code keeps its history
      code_emailed_at: sameCode ? (existing?.code_emailed_at ?? null) : null,
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
      .update({ code, updated_at: new Date().toISOString(), code_emailed_at: null }).eq('email', email);
    if (error) return json(req, 500, { ok: false, reason: 'store' });
    return json(req, 200, {
      ok: true, code,
      emailDraft: buildCodeEmail(inv.name, email, code),
    });
  }

  // ---------- mark the current code's email as drafted ----------
  if (action === 'mark-emailed') {
    const email = normEmail(body.email);
    if (!email) return json(req, 400, { ok: false, reason: 'bad-email' });
    const { error } = await supa.from('investors')
      .update({ code_emailed_at: new Date().toISOString() }).eq('email', email);
    if (error) return json(req, 500, { ok: false, reason: 'store' });
    return json(req, 200, { ok: true });
  }

  // ---------- change passcode ----------
  if (action === 'change-passcode') {
    const current = String(body.current ?? '');
    const next = String(body.next ?? '');
    if (!(await passcodeValid(supa, current))) {
      await delay();
      return json(req, 401, { ok: false, reason: 'bad-current' });
    }
    if (next.length < 8 || next.length > 72 || next !== next.trim()) {
      return json(req, 400, { ok: false, reason: 'weak-passcode' });
    }
    const { error } = await supa.from('admin_settings').upsert({
      id: 1, passcode_hash: await sha256Hex(next), updated_at: new Date().toISOString(),
    });
    if (error) return json(req, 500, { ok: false, reason: 'store' });
    return json(req, 200, { ok: true });
  }

  // ---------- launch list: manual add ----------
  if (action === 'launch-add') {
    const email = normEmail(body.email);
    if (!email) return json(req, 400, { ok: false, reason: 'bad-email' });
    const { error } = await supa.from('launch_list')
      .upsert({ email, source: 'manual' }, { onConflict: 'email', ignoreDuplicates: true });
    if (error) return json(req, 500, { ok: false, reason: 'store' });
    return json(req, 200, { ok: true });
  }

  // ---------- bug / change-request report ----------
  if (action === 'bug-report') {
    const message = str(body.message, 4000);
    if (!message) return json(req, 400, { ok: false, reason: 'bad-message' });
    let imagePath: string | null = null;
    const img = body.image as { name?: string; type?: string; dataBase64?: string } | undefined;
    if (img?.dataBase64 && /^image\//.test(img.type ?? '')) {
      try {
        const bytes = Uint8Array.from(atob(img.dataBase64), (c) => c.charCodeAt(0));
        if (bytes.length <= 4_500_000) {
          const ext = (img.name ?? 'shot.png').split('.').pop()?.slice(0, 5) || 'png';
          imagePath = `bug-${Date.now()}.${ext}`;
          const { error: upErr } = await supa.storage.from('bug-images')
            .upload(imagePath, bytes, { contentType: img.type });
          if (upErr) imagePath = null;
        }
      } catch { imagePath = null; }
    }
    const { data: bug, error } = await supa.from('bug_reports')
      .insert({ message, image_path: imagePath }).select('*').single();
    if (error) return json(req, 500, { ok: false, reason: 'store' });

    let imageLine = '';
    if (imagePath) {
      const { data: signed } = await supa.storage.from('bug-images')
        .createSignedUrl(imagePath, 60 * 60 * 24 * 14);
      if (signed?.signedUrl) imageLine = `\nScreenshot (link valid 14 days):\n${signed.signedUrl}\n`;
    }
    const mail = await sendEmail({
      to: 'adam@previsiondesign.com',
      subject: `genny dashboard — bug/change request #${bug.id}`,
      text: `Natasha filed a bug / change request:\n\n${message}\n${imageLine}\nTrack it: ${Deno.env.get('SITE_BASE') ?? 'https://gennyspritz.com'}/admin/#bugs-sec`,
    });
    return json(req, 200, { ok: true, bug, emailSent: mail.sent });
  }

  // ---------- bug status (resolved / reopened with note) ----------
  if (action === 'bug-status') {
    const id = parseInt(str(body.id, 20), 10);
    const newStatus = body.status === 'resolved' ? 'resolved' : body.status === 'reopened' ? 'reopened' : null;
    if (!Number.isFinite(id) || !newStatus) return json(req, 400, { ok: false, reason: 'bad-input' });
    const { data: bug } = await supa.from('bug_reports').select('*').eq('id', id).maybeSingle();
    if (!bug) return json(req, 404, { ok: false, reason: 'no-bug' });
    const notes = Array.isArray(bug.notes) ? bug.notes : [];
    const note = str(body.note, 2000);
    if (newStatus === 'reopened' && note) {
      notes.push({ at: new Date().toISOString(), text: note });
    }
    const { error } = await supa.from('bug_reports')
      .update({ status: newStatus, notes, updated_at: new Date().toISOString() }).eq('id', id);
    if (error) return json(req, 500, { ok: false, reason: 'store' });
    if (newStatus === 'reopened') {
      await sendEmail({
        to: 'adam@previsiondesign.com',
        subject: `genny dashboard — request #${id} NOT resolved`,
        text: `Natasha marked request #${id} as not resolved.\n\nOriginal:\n${bug.message}\n\nHer follow-up:\n${note || '(no detail given)'}`,
      });
    }
    return json(req, 200, { ok: true });
  }

  // ---------- signed URL for a bug screenshot ----------
  if (action === 'bug-image') {
    const id = parseInt(str(body.id, 20), 10);
    const { data: bug } = await supa.from('bug_reports').select('image_path').eq('id', id).maybeSingle();
    if (!bug?.image_path) return json(req, 404, { ok: false, reason: 'no-image' });
    const { data: signed, error } = await supa.storage.from('bug-images')
      .createSignedUrl(bug.image_path, 3600);
    if (error || !signed?.signedUrl) return json(req, 500, { ok: false, reason: 'sign' });
    return json(req, 200, { ok: true, url: signed.signedUrl });
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
