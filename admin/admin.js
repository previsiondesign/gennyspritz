/* Founder dashboard: passcode gate → requests / investors / financials.
   All DOM is built with createElement + textContent (request fields are
   untrusted input — never innerHTML them). */
(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };
  var KEY_STORE = 'genny-admin-key';
  var SITE_BASE = 'https://previsiondesign.github.io/gennyspritz';
  var IDLE_MS = 10 * 60 * 1000;   // auto sign-out after 10 min of inactivity
  var state = { key: null, overview: null, finDoc: null };
  var lastActivity = Date.now();

  // Session lives in sessionStorage: it dies with the tab. (Clean up any
  // key left behind by the earlier localStorage version.)
  try { localStorage.removeItem(KEY_STORE); } catch (e) {}
  function readKey() { try { return sessionStorage.getItem(KEY_STORE); } catch (e) { return null; } }
  function writeKey(k) { try { sessionStorage.setItem(KEY_STORE, k); } catch (e) {} }
  function dropKey() { try { sessionStorage.removeItem(KEY_STORE); } catch (e) {} }

  // ---------- tiny DOM helpers ----------
  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  function btn(cls, label, onClick) {
    var b = el('button', 'btn-sm ' + cls, label);
    b.type = 'button';
    b.addEventListener('click', onClick);
    return b;
  }
  function fmt(iso, withTime) {
    if (!iso) return '—';
    var d = new Date(iso);
    return withTime
      ? d.toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
      : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  function api(path, opts) {
    opts = opts || {};
    opts.adminKey = state.key;
    return GennyAPI.call(path, opts).then(function (res) {
      // 401 'bad-current' is the change-passcode form's inline error, not a
      // dead session — only the gate rejection logs her out.
      if (res.status === 401 && !(res.data && res.data.reason === 'bad-current')) {
        lock('Your session ended — please sign in again.');
        throw new Error('auth');
      }
      if (res.status === 429) { lock('Too many failed attempts — wait 10 minutes and try again.'); throw new Error('locked'); }
      return res;
    });
  }

  // ---------- gate ----------
  function lock(msg) {
    state.key = null;
    dropKey();
    $('dash').hidden = true; $('refresh').hidden = true; $('lock').hidden = true;
    $('gate').hidden = false;
    $('gate-pass').value = '';
    if (msg) { $('gate-error').textContent = msg; $('gate-error').hidden = false; }
  }

  function unlock(key) {
    state.key = key;
    lastActivity = Date.now();
    $('gate-btn').disabled = true; $('gate-btn').textContent = 'Checking…';
    GennyAPI.call('/admin/overview', { adminKey: key }).then(function (res) {
      $('gate-btn').disabled = false; $('gate-btn').textContent = 'Open dashboard';
      if (res.status === 200 && res.data && res.data.ok) {
        writeKey(key);
        $('gate').hidden = true; $('dash').hidden = false;
        $('refresh').hidden = false; $('lock').hidden = false;
        state.overview = res.data;
        renderOverview();
        loadFinancials();
      } else if (res.status === 429) {
        lock('Too many failed attempts — wait 10 minutes and try again.');
      } else if (res.status === 0) {
        lock("Couldn't reach the secure server — check your connection.");
      } else {
        lock("That passcode didn't work — try again.");
      }
    });
  }

  // ---------- overview ----------
  function loadOverview() {
    return api('/admin/overview').then(function (res) {
      if (res.status === 200 && res.data.ok) { state.overview = res.data; renderOverview(); }
    }).catch(function () {});
  }

  function mailtoDraft(email, draft) {
    location.href = 'mailto:' + encodeURIComponent(email) +
      '?subject=' + encodeURIComponent(draft.subject) +
      '&body=' + encodeURIComponent(draft.body);
  }
  function clientDraft(name, email, code) {
    var first = (name || '').trim().split(/\s+/)[0] || 'there';
    return {
      subject: 'Your private access code for genny financials',
      body: 'Hi ' + first + ',\n\nThank you for your interest in genny. Your private access code is:\n\n    ' +
        code + '\n\nView the financials here:\n' + SITE_BASE + '/investors/\n\nSign in with your email (' +
        email + ') and the code above. The code stays valid until access is closed. These materials are ' +
        "confidential — please don't forward them.\n\n— Natasha\nnatashaik@icloud.com · (415) 608-8050",
    };
  }

  function copyable(code) {
    var c = el('span', 'ad-code', code);
    c.title = 'Click to copy';
    c.addEventListener('click', function () {
      navigator.clipboard && navigator.clipboard.writeText(code).then(function () {
        c.textContent = 'copied ✓';
        setTimeout(function () { c.textContent = code; }, 1200);
      });
    });
    return c;
  }

  function renderOverview() {
    var data = state.overview;
    renderRequests(data.requests || []);
    renderInvestors(data.investors || []);
    var fresh = (data.requests || []).filter(function (r) { return r.status === 'new'; }).length;
    $('badge-requests').hidden = fresh === 0;
    $('badge-requests').textContent = fresh;
  }

  function requestRow(r) {
    var row = el('div', 'ad-row');
    var main = el('div', 'ad-row-main');
    var nameLine = el('div', 'ad-row-name', r.type === 'reset' ? (r.name || r.email) : (r.name || '(no name)'));
    if (r.type === 'reset') nameLine.appendChild(el('span', 'ad-pill reset', 'code reset'));
    if (r.investorStatus === 'active') nameLine.appendChild(el('span', 'ad-pill ghost', 'already has access'));
    if (r.investorStatus === 'revoked') nameLine.appendChild(el('span', 'ad-pill revoked', 'was revoked'));
    if (r.type === 'reset' && !r.known_investor) nameLine.appendChild(el('span', 'ad-pill warn', 'no matching investor'));
    main.appendChild(nameLine);
    main.appendChild(el('div', 'ad-row-meta', r.email + (r.firm ? ' · ' + r.firm : '') + ' · ' + fmt(r.created_at, true)));
    if (r.note) main.appendChild(el('div', 'ad-row-note', '“' + r.note + '”'));
    row.appendChild(main);

    var actions = el('div', 'ad-row-actions');
    if (r.status === 'new') {
      actions.appendChild(btn('grant', r.type === 'reset' ? 'Send new code' : 'Grant access', function () {
        var call = r.type === 'reset' && r.investorStatus === 'active'
          ? api('/admin/regenerate', { method: 'POST', body: { email: r.email } })
          : api('/admin/grant', { method: 'POST', body: { requestId: r.id } });
        call.then(function (res) {
          if (res.status === 200 && res.data.ok) {
            if (r.type === 'reset' && r.investorStatus === 'active') {
              api('/admin/dismiss', { method: 'POST', body: { requestId: r.id } });
            }
            mailtoDraft(r.email, res.data.emailDraft);
            loadOverview();
          } else {
            alert('Could not grant: ' + (res.data && res.data.reason || 'error'));
          }
        }).catch(function () {});
      }));
      actions.appendChild(btn('quiet', 'Dismiss', function () {
        api('/admin/dismiss', { method: 'POST', body: { requestId: r.id } }).then(loadOverview).catch(function () {});
      }));
    } else {
      actions.appendChild(el('span', 'ad-pill ' + (r.status === 'granted' ? 'active' : 'revoked'), r.status));
    }
    row.appendChild(actions);
    return row;
  }

  function renderRequests(requests) {
    var mount = $('requests-list');
    mount.innerHTML = '';
    var fresh = requests.filter(function (r) { return r.status === 'new'; });
    var handled = requests.filter(function (r) { return r.status !== 'new'; });
    if (!fresh.length) mount.appendChild(el('p', 'ad-empty', 'No open requests — nice and quiet. ✨'));
    fresh.forEach(function (r) { mount.appendChild(requestRow(r)); });
    if (handled.length) {
      var det = el('details');
      det.appendChild(el('summary', 'ad-views', 'Handled requests (' + handled.length + ')'));
      handled.slice(0, 50).forEach(function (r) { det.appendChild(requestRow(r)); });
      mount.appendChild(det);
    }
  }

  function investorRow(i) {
    var row = el('div', 'ad-row');
    var main = el('div', 'ad-row-main');
    var nameLine = el('div', 'ad-row-name', i.name || i.email);
    nameLine.appendChild(el('span', 'ad-pill ' + (i.status === 'active' ? 'active' : 'revoked'), i.status));
    main.appendChild(nameLine);
    var meta = el('div', 'ad-row-meta');
    meta.appendChild(document.createTextNode(i.email + (i.firm ? ' · ' + i.firm : '') + ' · code '));
    meta.appendChild(copyable(i.code));
    meta.appendChild(document.createTextNode(' · granted ' + fmt(i.created_at)));
    main.appendChild(meta);

    var views = el('div', 'ad-views');
    if (i.viewCount > 0) {
      var det = el('details');
      det.appendChild(el('summary', null, i.viewCount + ' view' + (i.viewCount === 1 ? '' : 's') +
        ' · last ' + fmt(i.lastViewAt, true)));
      var ul = el('ul');
      (i.views || []).forEach(function (v) { ul.appendChild(el('li', null, fmt(v, true))); });
      det.appendChild(ul);
      views.appendChild(det);
    } else {
      views.textContent = 'No views yet';
    }
    main.appendChild(views);
    row.appendChild(main);

    var actions = el('div', 'ad-row-actions');
    if (i.status === 'active') {
      actions.appendChild(btn('mail', 'Draft email', function () {
        mailtoDraft(i.email, clientDraft(i.name, i.email, i.code));
      }));
      actions.appendChild(btn('quiet', 'New code', function () {
        if (!confirm('Generate a NEW code for ' + i.email + '? The old code stops working.')) return;
        api('/admin/regenerate', { method: 'POST', body: { email: i.email } }).then(function (res) {
          if (res.status === 200 && res.data.ok) { mailtoDraft(i.email, res.data.emailDraft); loadOverview(); }
        }).catch(function () {});
      }));
      actions.appendChild(btn('danger', 'Revoke', function () {
        if (!confirm('Revoke access for ' + i.email + '? They are blocked immediately.')) return;
        api('/admin/revoke', { method: 'POST', body: { email: i.email } }).then(loadOverview).catch(function () {});
      }));
    } else {
      actions.appendChild(btn('grant', 'Re-grant', function () {
        api('/admin/grant', { method: 'POST', body: { email: i.email, name: i.name, firm: i.firm } })
          .then(function (res) {
            if (res.status === 200 && res.data.ok) { mailtoDraft(i.email, res.data.emailDraft); loadOverview(); }
          }).catch(function () {});
      }));
    }
    row.appendChild(actions);
    return row;
  }

  function renderInvestors(investors) {
    var mount = $('investors-list');
    mount.innerHTML = '';
    if (!investors.length) mount.appendChild(el('p', 'ad-empty', 'No investors yet — grant your first request above.'));
    investors.forEach(function (i) { mount.appendChild(investorRow(i)); });
  }

  // ---------- financials editor ----------
  function loadFinancials() {
    return api('/admin/financials').then(function (res) {
      if (res.status === 200 && res.data.ok) {
        state.finDoc = res.data.financials;
        $('fin-status').hidden = !res.data.isDefault;
        buildFinForm(state.finDoc);
        refreshPreview();
      }
    }).catch(function () {});
  }

  function numInput(id, value, step) {
    var i = el('input');
    i.type = 'number'; i.id = id; i.step = step || 'any'; i.value = value;
    i.addEventListener('input', refreshPreviewDebounced);
    return i;
  }
  function textInput(id, value, ph) {
    var i = el('input');
    i.type = 'text'; i.id = id; i.value = value; if (ph) i.placeholder = ph;
    i.addEventListener('input', refreshPreviewDebounced);
    return i;
  }

  function buildFinForm(doc) {
    var f = $('fin-form');
    f.innerHTML = '';

    // years
    var g1 = el('div', 'fe-group');
    g1.appendChild(el('h3', null, '5-year margin & volume'));
    doc.years.forEach(function (y, k) {
      var r = el('div', 'fe-row');
      r.appendChild(el('label', null, y.label));
      r.appendChild(numInput('y-m-' + k, y.marginPct, '0.1'));
      r.appendChild(numInput('y-c-' + k, y.cases, '1'));
      r.appendChild(el('span', 'fe-unit', '% · cases'));
      g1.appendChild(r);
    });
    f.appendChild(g1);

    // waterfall
    var g2 = el('div', 'fe-group');
    g2.appendChild(el('h3', null, 'Price waterfall · 4-pack'));
    var rp = el('div', 'fe-row');
    rp.appendChild(el('label', null, 'Retail price'));
    rp.appendChild(numInput('wf-price', doc.waterfall.retailPrice, '0.01'));
    rp.appendChild(el('span'));
    rp.appendChild(el('span', 'fe-unit', '$'));
    g2.appendChild(rp);
    doc.waterfall.rows.forEach(function (w, k) {
      var r = el('div', 'fe-row');
      r.appendChild(el('label', null, w.label));
      if (w.computed) {
        var c = el('span', 'fe-computed'); c.id = 'wf-computed';
        r.appendChild(c);
        r.appendChild(el('span'));
        r.appendChild(el('span', 'fe-unit', 'auto'));
      } else {
        r.appendChild(numInput('wf-a-' + k, w.amount, '0.01'));
        r.appendChild(el('span'));
        r.appendChild(el('span', 'fe-unit', '$'));
      }
      g2.appendChild(r);
    });
    f.appendChild(g2);

    // cogs
    var g3 = el('div', 'fe-group');
    g3.appendChild(el('h3', null, 'COGS breakdown · per can'));
    doc.cogs.slices.forEach(function (s, k) {
      var r = el('div', 'fe-row');
      r.appendChild(textInput('cg-l-' + k, s.label));
      r.appendChild(numInput('cg-p-' + k, s.pct, '0.1'));
      r.appendChild(el('span'));
      r.appendChild(el('span', 'fe-unit', '%'));
      g3.appendChild(r);
    });
    var hint = el('p', 'fe-hint'); hint.id = 'cogs-hint';
    g3.appendChild(hint);
    f.appendChild(g3);

    // benchmarks
    var g4 = el('div', 'fe-group');
    g4.appendChild(el('h3', null, 'Gross margin vs category'));
    doc.benchmarks.rows.forEach(function (b, k) {
      var r = el('div', 'fe-row');
      r.appendChild(textInput('bm-l-' + k, b.label));
      r.appendChild(numInput('bm-p-' + k, b.pct, '0.1'));
      var hl = el('label', 'fe-unit');
      var cb = el('input'); cb.type = 'checkbox'; cb.id = 'bm-h-' + k; cb.checked = !!b.highlight;
      cb.addEventListener('change', refreshPreviewDebounced);
      hl.appendChild(cb); hl.appendChild(document.createTextNode(' genny'));
      r.appendChild(hl);
      r.appendChild(el('span', 'fe-unit', '%'));
      g4.appendChild(r);
    });
    f.appendChild(g4);

    // caption
    var g5 = el('div', 'fe-group fe-caption');
    g5.appendChild(el('h3', null, 'Caption shown above the figures'));
    g5.appendChild(textInput('fin-caption', doc.caption, 'e.g. As of June 2026 — full model in the deck'));
    f.appendChild(g5);
  }

  function collectDoc() {
    var base = state.finDoc;
    var num = function (id, fb) { var v = parseFloat(($(id) || {}).value); return Number.isFinite(v) ? v : fb; };
    var txt = function (id, fb) { var n = $(id); return n && n.value.trim() ? n.value.trim() : fb; };
    var doc = JSON.parse(JSON.stringify(base));
    doc.years.forEach(function (y, k) {
      y.marginPct = num('y-m-' + k, y.marginPct);
      y.cases = num('y-c-' + k, y.cases);
    });
    doc.waterfall.retailPrice = num('wf-price', doc.waterfall.retailPrice);
    var spent = 0;
    doc.waterfall.rows.forEach(function (w, k) {
      if (!w.computed) { w.amount = num('wf-a-' + k, w.amount); spent += w.amount; }
    });
    doc.waterfall.rows.forEach(function (w) {
      if (w.computed) w.amount = Math.max(0, Math.round((doc.waterfall.retailPrice - spent) * 100) / 100);
    });
    doc.cogs.slices.forEach(function (s, k) {
      s.label = txt('cg-l-' + k, s.label);
      s.pct = num('cg-p-' + k, s.pct);
    });
    doc.benchmarks.rows.forEach(function (b, k) {
      b.label = txt('bm-l-' + k, b.label);
      b.pct = num('bm-p-' + k, b.pct);
      b.highlight = !!($('bm-h-' + k) || {}).checked;
    });
    doc.caption = txt('fin-caption', '');
    return doc;
  }

  var previewTimer = null;
  function refreshPreviewDebounced() {
    clearTimeout(previewTimer);
    previewTimer = setTimeout(refreshPreview, 250);
  }
  function refreshPreview() {
    var doc = collectDoc();
    var computed = $('wf-computed');
    var gross = doc.waterfall.rows.filter(function (w) { return w.computed; })[0];
    if (computed && gross) computed.textContent = '$' + gross.amount.toFixed(2);
    var sum = doc.cogs.slices.reduce(function (a, s) { return a + s.pct; }, 0);
    var hint = $('cogs-hint');
    if (hint) {
      hint.textContent = 'Slices sum to ' + Math.round(sum * 10) / 10 + '%';
      hint.className = 'fe-hint' + (Math.abs(sum - 100) > 0.5 ? ' bad' : '');
    }
    var mount = $('fin-preview');
    mount.innerHTML = '';
    mount.appendChild(window.renderFinancials(doc));
  }

  // ---------- wire up ----------
  if (!window.GennyAPI || !GennyAPI.configured) {
    $('not-configured').hidden = false;
    return;
  }

  $('gate-form').addEventListener('submit', function (e) {
    e.preventDefault();
    $('gate-error').hidden = true;
    var pass = $('gate-pass').value;
    if (pass) unlock(pass);
  });
  $('lock').addEventListener('click', function () { lock(); });
  $('refresh').addEventListener('click', function () { loadOverview(); loadFinancials(); });

  // ---- idle auto sign-out (10 min) ----
  ['pointerdown', 'keydown', 'wheel', 'touchstart', 'mousemove'].forEach(function (ev) {
    document.addEventListener(ev, function () { lastActivity = Date.now(); }, { passive: true });
  });
  function idleCheck() {
    if (state.key && Date.now() - lastActivity > IDLE_MS) {
      lock('Signed out after 10 minutes of inactivity.');
    }
  }
  setInterval(idleCheck, 30000);
  document.addEventListener('visibilitychange', function () {
    if (!document.hidden) idleCheck();   // catch up after the tab was backgrounded
  });

  // ---- change passcode ----
  $('pass-form').addEventListener('submit', function (e) {
    e.preventDefault();
    $('pass-error').hidden = true; $('pass-ok').hidden = true;
    var current = $('pc-current').value, next = $('pc-next').value, confirm2 = $('pc-confirm').value;
    var fail = function (m) { $('pass-error').textContent = m; $('pass-error').hidden = false; };
    if (!current || !next) return fail('Please fill in every field.');
    if (next !== confirm2) return fail("The new passcodes don't match.");
    if (next.length < 8) return fail('The new passcode needs at least 8 characters.');
    if (next !== next.trim()) return fail("The new passcode can't start or end with a space.");
    api('/admin/change-passcode', { method: 'POST', body: { current: current, next: next } })
      .then(function (res) {
        if (res.status === 200 && res.data.ok) {
          state.key = next;
          writeKey(next);
          $('pc-current').value = ''; $('pc-next').value = ''; $('pc-confirm').value = '';
          $('pass-ok').hidden = false;
        } else if (res.data && res.data.reason === 'bad-current') {
          fail("That current passcode didn't match.");
        } else {
          fail('Could not update the passcode — please try again.');
        }
      }).catch(function () {});
  });

  $('add-form').addEventListener('submit', function (e) {
    e.preventDefault();
    $('add-error').hidden = true;
    var name = $('add-name').value.trim(), email = $('add-email').value.trim(), firm = $('add-firm').value.trim();
    if (!name || !email) { $('add-error').textContent = 'Name and email are required.'; $('add-error').hidden = false; return; }
    api('/admin/grant', { method: 'POST', body: { email: email, name: name, firm: firm } }).then(function (res) {
      if (res.status === 200 && res.data.ok) {
        $('add-name').value = ''; $('add-email').value = ''; $('add-firm').value = '';
        mailtoDraft(email, res.data.emailDraft);
        loadOverview();
      } else {
        $('add-error').textContent = 'Could not add: ' + (res.data && res.data.reason || 'error');
        $('add-error').hidden = false;
      }
    }).catch(function () {});
  });

  $('fin-save').addEventListener('click', function () {
    $('fin-error').hidden = true; $('fin-saved').hidden = true;
    var doc = collectDoc();
    api('/admin/financials', { method: 'PUT', body: doc }).then(function (res) {
      if (res.status === 200 && res.data.ok) {
        state.finDoc = doc;
        $('fin-saved').hidden = false;
        $('fin-status').hidden = true;
        setTimeout(function () { $('fin-saved').hidden = true; }, 4000);
      } else {
        $('fin-error').textContent = 'Save failed: ' + (res.data && res.data.reason || 'error');
        $('fin-error').hidden = false;
      }
    }).catch(function () {});
  });

  var savedKey = readKey();
  if (savedKey) unlock(savedKey);
  else { $('gate').hidden = false; }
})();
