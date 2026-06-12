// Public endpoint: access requests, lost-code resets, launch-list signups.
// GET = ping (also used by the weekly keep-alive). POST = create.
import { preflight, json } from '../_shared/cors.ts';
import { db } from '../_shared/db.ts';
import { readJson, normEmail, str } from '../_shared/validate.ts';
import { sendEmail } from '../_shared/email.ts';
import { SITE_BASE } from '../_shared/defaults.ts';

const NOTIFY_TO = Deno.env.get('NOTIFY_REQUESTS_TO') ?? 'investor-request@gennyspritz.com';

Deno.serve(async (req) => {
  const pf = preflight(req);
  if (pf) return pf;

  if (req.method === 'GET') {
    // touch the DB so the free project never idles into a pause
    const { error } = await db().from('financials').select('id').limit(1);
    return json(req, 200, { ok: true, ping: true, db: !error });
  }
  if (req.method !== 'POST') return json(req, 405, { ok: false, reason: 'method' });

  const body = await readJson(req);
  if (!body) return json(req, 400, { ok: false, reason: 'bad-json' });

  const email = normEmail(body.email);
  if (!email) return json(req, 400, { ok: false, reason: 'bad-email' });

  const supa = db();

  // ---- launch-list signup ----
  if (body.kind === 'launch') {
    const { error } = await supa.from('launch_list')
      .upsert({ email, source: str(body.source, 60) || 'site' }, { onConflict: 'email', ignoreDuplicates: true });
    if (error) return json(req, 500, { ok: false, reason: 'store' });
    return json(req, 200, { ok: true });
  }

  // ---- access / reset requests ----
  const kind = body.kind === 'reset' ? 'reset' : 'access';
  let row: Record<string, unknown>;

  if (kind === 'reset') {
    // Never reveal to the caller whether this email has access —
    // the flag is dashboard-only.
    const { data: inv } = await supa.from('investors')
      .select('email,name').eq('email', email).maybeSingle();
    row = { type: 'reset', email, name: inv?.name ?? '', known_investor: !!inv };
  } else {
    const name = str(body.name, 120);
    if (!name) return json(req, 400, { ok: false, reason: 'bad-name' });
    row = { type: 'request', email, name, firm: str(body.firm, 160), note: str(body.note, 1000) };
  }

  const { data: inserted, error } = await supa.from('requests').insert(row).select('id').single();
  if (error) return json(req, 500, { ok: false, reason: 'store' });

  // Notify Natasha with a direct approve link (no-op until Resend is configured).
  const approveLink = `${SITE_BASE}/admin/?focus=${inserted.id}#requests`;
  const subject = kind === 'reset'
    ? `genny — code reset request from ${email}`
    : `genny — access request from ${row.name} (${row.firm || 'no firm'})`;
  const text = kind === 'reset'
    ? `${row.name ? row.name + ' — ' : ''}${email} lost their access code and asked for a new one.

Review and resend from your dashboard:
${approveLink}`
    : `New investor access request:

Name:  ${row.name}
Email: ${email}
Firm:  ${row.firm || '—'}
Note:  ${row.note || '—'}

Review and approve from your dashboard:
${approveLink}`;
  await sendEmail({ to: NOTIFY_TO, subject, text });

  return json(req, 200, { ok: true });
});
