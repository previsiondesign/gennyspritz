/* Investor page: email+code login → render financials; creds remembered
   per device; every visit re-validates server-side (and logs a view). */
(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };
  var CRED_KEY = 'genny-investor';

  document.querySelectorAll('[data-year]').forEach(function (el) {
    el.textContent = new Date().getFullYear();
  });

  function show(id) {
    ['not-configured', 'login', 'terms', 'revoked', 'financials-view'].forEach(function (s) {
      $(s).hidden = (s !== id);
    });
  }

  // creds awaiting terms acceptance (not remembered until agreed)
  var pending = null;

  function creds() {
    try { return JSON.parse(localStorage.getItem(CRED_KEY) || 'null'); }
    catch (e) { return null; }
  }
  function saveCreds(c) { try { localStorage.setItem(CRED_KEY, JSON.stringify(c)); } catch (e) {} }
  function clearCreds() { try { localStorage.removeItem(CRED_KEY); } catch (e) {} }

  function fmtDate(iso) {
    if (!iso) return null;
    try {
      return new Date(iso).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
    } catch (e) { return null; }
  }

  function renderView(data) {
    var name = (data.investor && data.investor.name || '').trim().split(/\s+/)[0];
    $('greeting').textContent = name ? ('Welcome, ' + name + '.') : 'The financials.';
    var meta = [];
    if (data.financials && data.financials.caption) meta.push(data.financials.caption);
    var d = fmtDate(data.updatedAt);
    if (d) meta.push('Figures updated ' + d);
    $('fin-meta').textContent = meta.join(' · ');
    var mount = $('fin-mount');
    mount.innerHTML = '';
    mount.appendChild(window.renderFinancials(data.financials));
    var deckWrap = $('deck-dl-wrap'), deckLink = $('deck-dl');
    if (deckWrap && deckLink) {
      if (data.deckUrl) { deckLink.href = data.deckUrl; deckWrap.hidden = false; }
      else { deckWrap.hidden = true; }
    }
    show('financials-view');
  }

  function attempt(email, code, fromStored, agree) {
    $('login-btn').disabled = true;
    $('login-btn').textContent = 'Checking…';
    var body = { email: email, code: code };
    if (agree) body.agree = true;
    GennyAPI.call('/financials', { method: 'POST', body: body })
      .then(function (res) {
        $('login-btn').disabled = false;
        $('login-btn').textContent = 'View the financials';
        if (res.status === 200 && res.data && res.data.ok && res.data.needsAgreement) {
          pending = { email: email, code: code };
          show('terms');
        } else if (res.status === 200 && res.data && res.data.ok) {
          pending = null;
          saveCreds({ email: email, code: code });
          renderView(res.data);
        } else if (res.status === 403) {
          clearCreds();
          show('revoked');
        } else if (res.status === 401) {
          if (fromStored) { clearCreds(); show('login'); }
          else err('login-error', "That email and code combination didn't match. Codes look like GS-XXXX-XXXX.");
        } else {
          if (fromStored) show('login');
          err('login-error', "Couldn't reach the secure server — please check your connection and try again.");
        }
      });
  }

  function err(id, msg) {
    var n = $(id);
    n.textContent = msg;
    n.hidden = false;
  }

  // ---- wire up ----
  if (!window.GennyAPI || !GennyAPI.configured) {
    show('not-configured');
    return;
  }

  $('login-form').addEventListener('submit', function (e) {
    e.preventDefault();
    $('login-error').hidden = true;
    var email = $('li-email').value.trim();
    var code = $('li-code').value.trim();
    if (!email || !code) { err('login-error', 'Please enter both your email and your access code.'); return; }
    attempt(email, code, false);
  });

  $('show-reset').addEventListener('click', function (e) {
    e.preventDefault();
    $('reset-form').hidden = !$('reset-form').hidden;
  });

  $('reset-form').addEventListener('submit', function (e) {
    e.preventDefault();
    $('reset-error').hidden = true; $('reset-ok').hidden = true;
    var email = $('rs-email').value.trim();
    if (!email) { err('reset-error', 'Please enter your email.'); return; }
    GennyAPI.call('/request', { method: 'POST', body: { kind: 'reset', email: email } })
      .then(function (res) {
        if (res.status === 200) { $('reset-ok').hidden = false; $('rs-email').value = ''; }
        else err('reset-error', "Couldn't send the request — please try again or email Natasha directly.");
      });
  });

  $('terms-agree').addEventListener('click', function () {
    if (pending) attempt(pending.email, pending.code, false, true);
  });

  $('terms-exit').addEventListener('click', function () {
    pending = null;
    clearCreds();
    $('li-code').value = '';
    show('login');
  });

  $('logout').addEventListener('click', function (e) {
    e.preventDefault();
    clearCreds();
    show('login');
  });

  $('revoked-retry').addEventListener('click', function (e) {
    e.preventDefault();
    clearCreds();
    show('login');
  });

  var stored = creds();
  if (stored && stored.email && stored.code) {
    show('login');                 // visible behind while checking
    attempt(stored.email, stored.code, true);
  } else {
    show('login');
  }
})();
