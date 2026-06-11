/* ============================================================
   GennyAPI — tiny client for the Supabase Edge Functions.
   The base URL is set once at deploy time; until then (or when
   overridden for local testing via localStorage 'genny-api-base')
   pages degrade gracefully: the public modal falls back to mailto
   and the admin/investor pages show a "not connected" card.
   ============================================================ */
(function () {
  'use strict';

  // Filled in at deploy: https://<project-ref>.supabase.co/functions/v1
  var DEFAULT_BASE = 'https://YOUR-PROJECT-REF.supabase.co/functions/v1';

  var override = null;
  try {
    // test hooks: ?api=<base> wins, then a localStorage override
    var qp = new URLSearchParams(location.search).get('api');
    override = qp || localStorage.getItem('genny-api-base');
  } catch (e) { /* no-op */ }
  var base = override || DEFAULT_BASE;
  var configured = base.indexOf('YOUR-PROJECT-REF') === -1;

  /**
   * call('/request', {method:'POST', body:{...}, adminKey:'...'})
   * Resolves {status, data} — network/timeout errors resolve {status:0}.
   */
  function call(path, opts) {
    opts = opts || {};
    var ctrl = new AbortController();
    var timer = setTimeout(function () { ctrl.abort(); }, opts.timeoutMs || 8000);
    var headers = { 'content-type': 'application/json' };
    if (opts.adminKey) headers['x-admin-key'] = opts.adminKey;
    return fetch(base + path, {
      method: opts.method || 'GET',
      headers: headers,
      body: opts.body != null ? JSON.stringify(opts.body) : undefined,
      signal: ctrl.signal,
    }).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (data) {
        return { status: res.status, data: data };
      });
    }).catch(function () {
      return { status: 0, data: null };
    }).finally(function () {
      clearTimeout(timer);
    });
  }

  window.GennyAPI = { call: call, configured: configured, base: base };
})();
