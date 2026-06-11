// Public endpoint: access requests + lost-code reset requests.
// GET = ping (also used by the weekly keep-alive). POST = create request.
import { preflight, json } from '../_shared/cors.ts';
import { db } from '../_shared/db.ts';
import { readJson, normEmail, str } from '../_shared/validate.ts';

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

  const kind = body.kind === 'reset' ? 'reset' : 'access';
  const email = normEmail(body.email);
  if (!email) return json(req, 400, { ok: false, reason: 'bad-email' });

  const supa = db();
  let row: Record<string, unknown>;

  if (kind === 'reset') {
    // Never reveal to the caller whether this email has access —
    // the flag is dashboard-only.
    const { data: inv } = await supa.from('investors')
      .select('email,name').eq('email', email).maybeSingle();
    row = {
      type: 'reset', email,
      name: inv?.name ?? '',
      known_investor: !!inv,
    };
  } else {
    const name = str(body.name, 120);
    if (!name) return json(req, 400, { ok: false, reason: 'bad-name' });
    row = {
      type: 'request', email, name,
      firm: str(body.firm, 160),
      note: str(body.note, 1000),
    };
  }

  const { error } = await supa.from('requests').insert(row);
  if (error) return json(req, 500, { ok: false, reason: 'store' });
  return json(req, 200, { ok: true });
});
