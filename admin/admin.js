/* Founder dashboard: passcode gate → requests / investors / financials.
   All DOM is built with createElement + textContent (request fields are
   untrusted input — never innerHTML them). */
(function () {
  'use strict';

  var $ = function (id) { return document.getElementById(id); };
  var KEY_STORE = 'genny-admin-key';
  var SITE_BASE = 'https://gennyspritz.com';
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
    var fm = $('fin-modal');
    if (fm) fm.classList.remove('open');
    editing = null;
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
        loadCodeEmail();
        loadDeckInfo();
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
      body: 'Hi ' + first + ',\n\nThank you for your interest in genny!\n\n' +
        "I've granted you access to our financial data. Your personal code is:\n\n" +
        code + '\n\nView the financials here:\n' + SITE_BASE + '/investors/\n\n' +
        'Sign in with your email (' + email + ') and the code above.\n' +
        "Note: These materials are confidential — please don't forward or share them without permission.\n\n" +
        'Natasha\nnatasha@gennyspritz.com\n(415) 608-8050',
    };
  }

  // remember that the current code's email has been drafted (hides Draft email)
  function markEmailed(email) {
    return api('/admin/mark-emailed', { method: 'POST', body: { email: email } }).catch(function () {});
  }

  // After grant/regenerate the backend emails the code as Natasha. If that
  // send failed (or Resend is off), fall back to opening a local draft.
  function deliverCode(email, res) {
    if (res.data.emailSent) {
      alert('✓ Access code emailed to ' + email + '.');
      loadOverview();
    } else {
      alert("Couldn't auto-send — opening a draft you can send manually.");
      mailtoDraft(email, res.data.emailDraft);
      markEmailed(email).then(loadOverview);
    }
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
    renderLaunchList(data.launchList || []);
    renderBugs(data.bugs || []);
    var fresh = (data.requests || []).filter(function (r) { return r.status === 'new'; }).length;
    $('badge-requests').hidden = fresh === 0;
    $('badge-requests').textContent = fresh;
    $('badge-launch').hidden = !(data.launchList || []).length;
    $('badge-launch').textContent = (data.launchList || []).length;
    focusRequestFromUrl();
  }

  // ?focus=<requestId> — the approve link in notification emails
  var focusDone = false;
  function focusRequestFromUrl() {
    if (focusDone) return;
    var id = new URLSearchParams(location.search).get('focus');
    if (!id) { focusDone = true; return; }
    var row = document.querySelector('[data-request-id="' + id.replace(/[^\w-]/g, '') + '"]');
    if (row) {
      focusDone = true;
      row.classList.add('ad-focus');
      row.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setTimeout(function () { row.classList.remove('ad-focus'); }, 6000);
    }
  }

  function renderLaunchList(list) {
    var mount = $('launch-list');
    mount.innerHTML = '';
    $('launch-count').textContent = list.length + (list.length === 1 ? ' signup' : ' signups');
    state.launchEmails = list.map(function (l) { return l.email; });
    if (!list.length) {
      mount.appendChild(el('p', 'ad-empty', 'No signups captured yet — they appear here the moment someone joins the list on the site.'));
      return;
    }
    var ul = el('ul', 'ad-launch-ul');
    list.forEach(function (l) {
      var li = el('li');
      li.appendChild(el('span', null, l.email));
      li.appendChild(el('em', null, fmt(l.created_at) + (l.source === 'manual' ? ' · added manually' : '')));
      ul.appendChild(li);
    });
    mount.appendChild(ul);
  }

  function renderBugs(bugs) {
    var mount = $('bugs-list');
    mount.innerHTML = '';
    if (!bugs.length) return;
    bugs.forEach(function (b) {
      var row = el('div', 'ad-row ad-bug-row');
      var main = el('div', 'ad-row-main');
      var name = el('div', 'ad-row-name', '#' + b.id);
      name.appendChild(el('span', 'ad-pill ' + (b.status === 'resolved' ? 'active' : b.status === 'reopened' ? 'warn' : 'new'),
        b.status === 'reopened' ? 'not resolved' : b.status));
      main.appendChild(name);
      main.appendChild(el('div', 'ad-row-meta', fmt(b.created_at, true)));
      main.appendChild(el('div', 'ad-row-note', b.message));
      (Array.isArray(b.notes) ? b.notes : []).forEach(function (n) {
        main.appendChild(el('div', 'ad-bug-note', '↳ ' + fmt(n.at, true) + ': ' + n.text));
      });
      if (b.image_path) {
        var link = el('a', 'ad-bug-img', 'View screenshot');
        link.href = '#';
        link.addEventListener('click', function (e) {
          e.preventDefault();
          api('/admin/bug-image', { method: 'POST', body: { id: b.id } }).then(function (res) {
            if (res.status === 200 && res.data.ok) window.open(res.data.url, '_blank');
          }).catch(function () {});
        });
        main.appendChild(link);
      }
      row.appendChild(main);

      var actions = el('div', 'ad-row-actions');
      if (b.status !== 'resolved') {
        actions.appendChild(btn('grant', 'Resolved', function () {
          api('/admin/bug-status', { method: 'POST', body: { id: b.id, status: 'resolved' } })
            .then(loadOverview).catch(function () {});
        }));
      }
      actions.appendChild(btn('quiet', 'Not resolved', function () {
        var existing = row.querySelector('.ad-reopen');
        if (existing) { existing.remove(); return; }
        var box = el('div', 'ad-reopen');
        var ta = el('textarea');
        ta.rows = 3; ta.placeholder = "What's still wrong, or what changed?";
        box.appendChild(ta);
        var send = el('button', 'btn-sm danger', 'Send to Adam');
        send.type = 'button';
        send.addEventListener('click', function () {
          api('/admin/bug-status', { method: 'POST', body: { id: b.id, status: 'reopened', note: ta.value.trim() } })
            .then(loadOverview).catch(function () {});
        });
        box.appendChild(send);
        row.appendChild(box);
        ta.focus();
      }));
      row.appendChild(actions);
      mount.appendChild(row);
    });
  }

  function requestRow(r) {
    var row = el('div', 'ad-row');
    row.setAttribute('data-request-id', r.id);
    var main = el('div', 'ad-row-main');
    var nameLine = el('div', 'ad-row-name', r.type === 'reset' ? (r.name || r.email) : (r.name || '(no name)'));
    if (r.type === 'reset') nameLine.appendChild(el('span', 'ad-pill reset', 'code reset'));
    if (r.investorStatus === 'active') nameLine.appendChild(el('span', 'ad-pill ghost', 'already has access'));
    if (r.investorStatus === 'revoked') nameLine.appendChild(el('span', 'ad-pill revoked', 'was revoked'));
    if (r.investorStatus === 'removed') nameLine.appendChild(el('span', 'ad-pill revoked', 'removed'));
    if (r.type === 'reset' && !r.known_investor) nameLine.appendChild(el('span', 'ad-pill warn', 'no matching investor'));
    main.appendChild(nameLine);
    main.appendChild(el('div', 'ad-row-meta', r.email + (r.firm ? ' · ' + r.firm : '') + ' · ' + fmt(r.created_at, true)));
    if (r.investorRevokedAt || r.investorRemovedAt) {
      var fateParts = [];
      if (r.investorRevokedAt) fateParts.push('access revoked ' + fmt(r.investorRevokedAt, true));
      if (r.investorRemovedAt) fateParts.push('removed ' + fmt(r.investorRemovedAt, true));
      main.appendChild(el('div', 'ad-row-meta', fateParts.join(' · ')));
    }
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
            deliverCode(r.email, res);
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
    meta.appendChild(document.createTextNode(i.agreed_at
      ? ' · terms accepted ' + fmt(i.agreed_at)
      : ' · terms not yet accepted'));
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
      // Draft email shows only while the current code hasn't been emailed yet
      // (fresh grant or after New code); drafting it hides the button again.
      if (!i.code_emailed_at) {
        actions.appendChild(btn('mail', 'Draft email', function () {
          mailtoDraft(i.email, clientDraft(i.name, i.email, i.code));
          markEmailed(i.email).then(loadOverview);
        }));
      }
      actions.appendChild(btn('quiet', 'New code', function () {
        if (!confirm('Generate a NEW code for ' + i.email + '? The old code stops working and the new one is emailed to them automatically.')) return;
        api('/admin/regenerate', { method: 'POST', body: { email: i.email } }).then(function (res) {
          if (res.status === 200 && res.data.ok) deliverCode(i.email, res);
          else loadOverview();
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
            if (res.status === 200 && res.data.ok) {
              deliverCode(i.email, res);
            }
          }).catch(function () {});
      }));
      actions.appendChild(btn('danger', 'Remove', function () {
        if (!confirm('Remove ' + i.email + " from the list? This permanently deletes them and their view history. They're already revoked, so access stays blocked.")) return;
        api('/admin/remove', { method: 'POST', body: { email: i.email } }).then(loadOverview).catch(function () {});
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

  // ---------- financials: WYSIWYG preview + per-card edit dialogs ----------
  function loadFinancials() {
    return api('/admin/financials').then(function (res) {
      if (res.status === 200 && res.data.ok) {
        state.finDoc = res.data.financials;
        $('fin-status').hidden = !res.data.isDefault;
        renderFin();
      }
    }).catch(function () {});
  }

  function renderFin() {
    $('fin-caption-text').textContent = state.finDoc.caption || '(no caption)';
    var mount = $('fin-preview');
    mount.innerHTML = '';
    mount.appendChild(window.renderFinancials(state.finDoc, { onEdit: openEditor }));
    renderPublicTeaser();
  }

  var DEFAULT_PT = function () {
    return {
      stats: [
        { label: 'Gross margin at launch', link: 'marginLaunch' },
        { label: '4-pack at shelf', link: 'retail' },
        { label: 'Margin path within 3 yrs', value: '68–70%', link: '' },
      ],
      useOfCapital: { title: 'Use of capital', slices: [
        { label: 'Production & dry goods', pct: 30 }, { label: 'Sales & trade tools', pct: 30 },
        { label: 'Marketing', pct: 20 }, { label: 'Wine & flavor', pct: 20 } ] },
    };
  };
  function pubTeaser() {
    if (!state.finDoc.publicTeaser) state.finDoc.publicTeaser = DEFAULT_PT();
    return state.finDoc.publicTeaser;
  }
  function ptPencil(section, label) {
    var b = el('button', 'fin-edit-btn');
    b.type = 'button';
    b.setAttribute('aria-label', 'Edit ' + label); b.title = 'Edit ' + label;
    b.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
      'stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.8 2.8 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5z"/></svg>';
    b.addEventListener('click', function () { openEditor(section); });
    return b;
  }
  function ptCard(title, section, label) {
    var card = el('div', 'ad-pt-card');
    var head = el('div', 'ad-pt-card-h');
    head.appendChild(el('span', null, title));
    head.appendChild(ptPencil(section, label));
    card.appendChild(head);
    return card;
  }
  function renderPublicTeaser() {
    var pt = pubTeaser();
    var mount = $('pt-mount');
    if (!mount) return;
    mount.innerHTML = '';

    var sc = ptCard('Headline stats', 'publicStats', 'the homepage stats');
    var sul = el('ul', 'ad-pt-list');
    (pt.stats || []).forEach(function (s) {
      var li = el('li');
      li.appendChild(el('span', 'ad-pt-label', s.label));
      var v = s.link === 'marginLaunch' ? 'launch margin · auto'
            : s.link === 'retail' ? 'retail price · auto'
            : (s.value || '—');
      var b = el('b', s.link ? 'ad-pt-auto' : null, v);
      li.appendChild(b);
      sul.appendChild(li);
    });
    sc.appendChild(sul);
    mount.appendChild(sc);

    var cc = ptCard((pt.useOfCapital && pt.useOfCapital.title) || 'Use of capital', 'publicUoC', 'the use-of-capital split');
    var cul = el('ul', 'ad-pt-list');
    ((pt.useOfCapital && pt.useOfCapital.slices) || []).forEach(function (s) {
      var li = el('li');
      li.appendChild(el('span', 'ad-pt-label', s.label));
      li.appendChild(el('b', null, (Math.round(s.pct * 10) / 10) + '%'));
      cul.appendChild(li);
    });
    cc.appendChild(cul);
    mount.appendChild(cc);
  }

  function numInput(id, value, step) {
    var i = el('input');
    i.type = 'number'; i.id = id; i.step = step || 'any'; i.value = value;
    return i;
  }
  function textInput(id, value, ph) {
    var i = el('input');
    i.type = 'text'; i.id = id; i.value = value; if (ph) i.placeholder = ph;
    return i;
  }
  var numVal = function (id, fb) { var v = parseFloat(($(id) || {}).value); return Number.isFinite(v) ? v : fb; };
  var txtVal = function (id, fb) { var n = $(id); return n && n.value.trim() ? n.value.trim() : fb; };

  var FIN_TITLES = {
    topStats: 'Headline stats',
    years: 'Year-by-year margin & volume',
    narrative: 'Narrative',
    waterfall: 'Price waterfall',
    cogs: 'COGS breakdown',
    benchmarks: 'Margin benchmarks',
    evolution: 'Revenue, cost & margin evolution',
    costCompress: 'Cost compression',
    assumptions: 'Model assumptions',
    caption: 'Caption above the figures',
    publicStats: 'Homepage stats (public)',
    publicUoC: 'Use of capital (public)',
  };
  var FIN_SUBS = {
    topStats: 'The stat cards across the top. Tick “tint” to highlight one.',
    years: 'Every year in one place — margin %, cases, revenue line and change-vs-launch.',
    narrative: 'Short paragraphs shown to investors. Separate paragraphs with a blank line.',
    waterfall: 'Where the retail price goes. Gross profit recalculates automatically.',
    cogs: 'Slices should sum to 100%. Add or remove categories as needed.',
    benchmarks: 'How genny compares. Tick “genny” to highlight a row in coral.',
    evolution: 'Per-year FOB price, COGS and gross margin — drives the line chart.',
    costCompress: 'Cost components per year — drives the stacked bars.',
    assumptions: 'Label / value pairs shown as the assumptions table.',
    caption: 'Shown to investors above the figures (e.g. “As of June 2026”).',
    publicStats: 'The three stats on the public homepage. Link a stat to the deck to keep it in sync, or set a custom value.',
    publicUoC: 'The public use-of-capital donut on the homepage. Add or remove categories; aim for ~100%.',
  };
  var editing = null;        // section key while the dialog is open
  var draft = null;          // working copy of the section being edited
  var clone = function (v) { return JSON.parse(JSON.stringify(v)); };

  // ---- tiny dialog builders (live-bound to `draft`) ----
  function rowWrap() { return el('div', 'fe-list'); }
  function bindText(obj, key, ph, cls) {
    var i = el('input', cls || null);
    i.type = 'text'; i.value = obj[key] != null ? obj[key] : ''; if (ph) i.placeholder = ph;
    i.addEventListener('input', function () { obj[key] = i.value; });
    return i;
  }
  function bindNum(obj, key, step) {
    var i = el('input');
    i.type = 'number'; i.step = step || '0.1'; i.value = obj[key];
    i.addEventListener('input', function () {
      var v = parseFloat(i.value);
      if (Number.isFinite(v)) obj[key] = v;
    });
    return i;
  }
  function bindCheck(obj, key, label) {
    var l = el('label', 'fe-unit');
    var cb = el('input'); cb.type = 'checkbox'; cb.checked = !!obj[key];
    cb.addEventListener('change', function () { obj[key] = cb.checked; });
    l.appendChild(cb); l.appendChild(document.createTextNode(' ' + label));
    return l;
  }
  function removeBtn(arr, idx, rebuild) {
    var b = el('button', 'fe-x', '✕');
    b.type = 'button'; b.title = 'Remove this row';
    b.addEventListener('click', function () {
      if (arr.length <= 1) return alert('Keep at least one row.');
      arr.splice(idx, 1); rebuild();
    });
    return b;
  }
  function addBtn(label, onClick) {
    var b = el('button', 'fe-add', '＋ ' + label);
    b.type = 'button';
    b.addEventListener('click', onClick);
    return b;
  }
  function titleField(body, ph) {
    if (!('title' in draft)) return;
    var r = el('div', 'fe-row fe-title-row');
    r.appendChild(el('label', null, 'Card heading'));
    var i = bindText(draft, 'title', ph || 'Heading shown on the card');
    i.style.gridColumn = '2 / -1';
    r.appendChild(i);
    body.appendChild(r);
  }

  function buildDialog(section) {
    // fresh node each time so per-dialog listeners don't accumulate
    var old = $('finm-body');
    var body = old.cloneNode(false);
    old.parentNode.replaceChild(body, old);
    var rebuild = function () { buildDialog(section); };

    if (section === 'caption') {
      var r = el('div');
      var i = bindText(draft, 'caption', 'e.g. Confidential · as of June 2026');
      i.style.width = '100%';
      r.appendChild(i);
      body.appendChild(r);
      return;
    }

    titleField(body);

    if (section === 'topStats') {
      draft.items.forEach(function (s, k) {
        var r = el('div', 'fe-row fe-4col');
        r.appendChild(bindText(s, 'label', 'Label'));
        r.appendChild(bindText(s, 'value', '$0.00'));
        r.appendChild(bindText(s, 'sub', 'Small sub-line'));
        var end = el('span', 'fe-end');
        end.appendChild(bindCheck(s, 'highlight', 'tint'));
        end.appendChild(removeBtn(draft.items, k, rebuild));
        r.appendChild(end);
        body.appendChild(r);
      });
      body.appendChild(addBtn('Add stat', function () {
        draft.items.push({ label: 'New stat', value: '—', sub: '' }); rebuild();
      }));
    }

    if (section === 'years') {
      var head = el('div', 'finm-head fe-5col');
      ['Label', 'Margin %', 'Cases', 'Revenue line', 'Change'].forEach(function (h) {
        head.appendChild(el('span', null, h));
      });
      body.appendChild(head);
      draft.items.forEach(function (y, k) {
        var r = el('div', 'fe-row fe-5col');
        r.appendChild(bindText(y, 'label', 'Year 1'));
        r.appendChild(bindNum(y, 'marginPct', '0.1'));
        r.appendChild(bindNum(y, 'cases', '1'));
        r.appendChild(bindText(y, 'revenue', '$1.0M revenue'));
        var end = el('span', 'fe-end');
        end.appendChild(bindText(y, 'delta', '+2.9 pts'));
        end.appendChild(removeBtn(draft.items, k, rebuild));
        r.appendChild(end);
        body.appendChild(r);
      });
      body.appendChild(addBtn('Add year', function () {
        draft.items.push({ label: 'Year ' + (draft.items.length + 1), marginPct: 60, cases: 1000, revenue: '', delta: '' });
        rebuild();
      }));
    }

    if (section === 'narrative') {
      var ta = el('textarea', 'fe-textarea');
      ta.rows = 7;
      ta.value = (draft.paragraphs || []).join('\n\n');
      ta.addEventListener('input', function () {
        draft.paragraphs = ta.value.split(/\n\s*\n/).map(function (p) { return p.trim(); }).filter(Boolean);
      });
      body.appendChild(ta);
    }

    if (section === 'waterfall') {
      var grossLine = el('p', 'fe-computed');
      var recompute = function () {
        var spent = 0;
        draft.rows.forEach(function (w) { if (!w.computed) spent += w.amount; });
        draft.rows.forEach(function (w) {
          if (w.computed) w.amount = Math.max(0, Math.round((draft.retailPrice - spent) * 100) / 100);
        });
        var g = draft.rows.filter(function (w) { return w.computed; })[0];
        grossLine.textContent = g ? (g.label + ' (auto): $' + g.amount.toFixed(2)) : '';
      };
      var rp = el('div', 'fe-row');
      rp.appendChild(el('label', null, 'Retail price'));
      rp.appendChild(bindNum(draft, 'retailPrice', '0.01'));
      rp.appendChild(el('span'));
      rp.appendChild(el('span', 'fe-unit', '$ per 4-pack'));
      body.appendChild(rp);
      draft.rows.forEach(function (w, k) {
        if (w.computed) return;
        var r = el('div', 'fe-row');
        r.appendChild(bindText(w, 'label', 'Row label'));
        r.appendChild(bindNum(w, 'amount', '0.01'));
        var end = el('span', 'fe-end');
        end.appendChild(el('span', 'fe-unit', '$'));
        end.appendChild(removeBtn(draft.rows, k, rebuild));
        r.appendChild(end);
        body.appendChild(r);
      });
      body.appendChild(grossLine);
      body.appendChild(addBtn('Add row', function () {
        draft.rows.splice(draft.rows.length - 1, 0, { label: 'New row', amount: 0 }); rebuild();
      }));
      body.addEventListener('input', recompute);
      recompute();
    }

    if (section === 'cogs') {
      var hint = el('p', 'fe-hint');
      var sumHint = function () {
        var sum = draft.slices.reduce(function (a, s) { return a + s.pct; }, 0);
        hint.textContent = 'Slices sum to ' + (Math.round(sum * 10) / 10).toFixed(1) + '%';
        hint.className = 'fe-hint' + (Math.abs(sum - 100) > 0.5 ? ' bad' : '');
      };
      draft.slices.forEach(function (s, k) {
        var r = el('div', 'fe-row');
        r.appendChild(bindText(s, 'label', 'Category'));
        r.appendChild(bindNum(s, 'pct', '0.1'));
        var end = el('span', 'fe-end');
        end.appendChild(el('span', 'fe-unit', '%'));
        end.appendChild(removeBtn(draft.slices, k, rebuild));
        r.appendChild(end);
        body.appendChild(r);
      });
      body.appendChild(hint);
      body.appendChild(addBtn('Add category', function () {
        draft.slices.push({ label: 'New category', pct: 0 }); rebuild();
      }));
      body.addEventListener('input', sumHint);
      sumHint();
    }

    if (section === 'benchmarks') {
      draft.rows.forEach(function (b, k) {
        var r = el('div', 'fe-row');
        r.appendChild(bindText(b, 'label', 'Benchmark'));
        r.appendChild(bindNum(b, 'pct', '0.1'));
        var end = el('span', 'fe-end');
        end.appendChild(bindCheck(b, 'highlight', 'genny'));
        end.appendChild(removeBtn(draft.rows, k, rebuild));
        r.appendChild(end);
        body.appendChild(r);
      });
      body.appendChild(addBtn('Add row', function () {
        draft.rows.push({ label: 'New benchmark', pct: 50 }); rebuild();
      }));
    }

    if (section === 'evolution') {
      var subR = el('div', 'fe-row fe-title-row');
      subR.appendChild(el('label', null, 'Sub-heading'));
      var subI = bindText(draft, 'sub', 'e.g. Per 4-pack · FOB basis');
      subI.style.gridColumn = '2 / -1';
      subR.appendChild(subI);
      body.appendChild(subR);
      var head = el('div', 'finm-head fe-4col');
      ['Label', 'FOB $', 'COGS $', 'Margin %'].forEach(function (h) { head.appendChild(el('span', null, h)); });
      body.appendChild(head);
      draft.rows.forEach(function (r0, k) {
        var r = el('div', 'fe-row fe-4col');
        r.appendChild(bindText(r0, 'label', 'Y1'));
        r.appendChild(bindNum(r0, 'fob', '0.01'));
        r.appendChild(bindNum(r0, 'cogs', '0.01'));
        var end = el('span', 'fe-end');
        end.appendChild(bindNum(r0, 'marginPct', '0.1'));
        end.appendChild(removeBtn(draft.rows, k, rebuild));
        r.appendChild(end);
        body.appendChild(r);
      });
      body.appendChild(addBtn('Add year', function () {
        draft.rows.push({ label: 'Y' + (draft.rows.length + 1), fob: 10, cogs: 3, marginPct: 65 }); rebuild();
      }));
    }

    if (section === 'costCompress') {
      var subR2 = el('div', 'fe-row fe-title-row');
      subR2.appendChild(el('label', null, 'Sub-heading'));
      var subI2 = bindText(draft, 'sub', 'e.g. COGS composition per 4-pack');
      subI2.style.gridColumn = '2 / -1';
      subR2.appendChild(subI2);
      body.appendChild(subR2);
      body.appendChild(el('p', 'fe-hint', 'Cost components (the chart colors):'));
      draft.components.forEach(function (c, k) {
        var r = el('div', 'fe-row fe-comp');
        var i = el('input'); i.type = 'text'; i.value = c;
        i.addEventListener('input', function () { draft.components[k] = i.value; });
        r.appendChild(i);
        var x = el('button', 'fe-x', '✕'); x.type = 'button';
        x.addEventListener('click', function () {
          if (draft.components.length <= 1) return alert('Keep at least one component.');
          draft.components.splice(k, 1);
          draft.rows.forEach(function (row) { row.values.splice(k, 1); });
          rebuild();
        });
        r.appendChild(x);
        body.appendChild(r);
      });
      body.appendChild(addBtn('Add component', function () {
        draft.components.push('New component');
        draft.rows.forEach(function (row) { row.values.push(0); });
        rebuild();
      }));
      body.appendChild(el('p', 'fe-hint', 'Per-year values ($):'));
      draft.rows.forEach(function (row, rk) {
        var r = el('div', 'fe-row fe-grid');
        r.style.gridTemplateColumns = '90px repeat(' + draft.components.length + ', 1fr) auto';
        r.appendChild(bindText(row, 'label', 'Y1'));
        row.values.forEach(function (_, vk) {
          var i = el('input'); i.type = 'number'; i.step = '0.01'; i.value = row.values[vk];
          i.title = draft.components[vk];
          i.addEventListener('input', function () {
            var v = parseFloat(i.value);
            if (Number.isFinite(v)) row.values[vk] = v;
          });
          r.appendChild(i);
        });
        r.appendChild(removeBtn(draft.rows, rk, rebuild));
        body.appendChild(r);
      });
      body.appendChild(addBtn('Add year', function () {
        draft.rows.push({ label: 'Y' + (draft.rows.length + 1), values: draft.components.map(function () { return 0; }) });
        rebuild();
      }));
    }

    if (section === 'assumptions') {
      draft.rows.forEach(function (a, k) {
        var r = el('div', 'fe-row');
        r.appendChild(bindText(a, 'label', 'Assumption'));
        r.appendChild(bindText(a, 'value', 'Value'));
        var end = el('span', 'fe-end');
        end.appendChild(removeBtn(draft.rows, k, rebuild));
        r.appendChild(end);
        body.appendChild(r);
      });
      body.appendChild(addBtn('Add assumption', function () {
        draft.rows.push({ label: 'New assumption', value: '—' }); rebuild();
      }));
    }

    if (section === 'publicStats') {
      var head = el('div', 'finm-head fe-pubstat');
      ['Label', 'Source', 'Value'].forEach(function (h) { head.appendChild(el('span', null, h)); });
      body.appendChild(head);
      draft.items.forEach(function (s, k) {
        var r = el('div', 'fe-row fe-pubstat');
        r.appendChild(bindText(s, 'label', 'Stat label'));
        var sel = el('select');
        [['', 'Custom value'], ['marginLaunch', 'Launch margin (deck)'], ['retail', 'Retail price (deck)']]
          .forEach(function (o) {
            var opt = el('option'); opt.value = o[0]; opt.textContent = o[1];
            if ((s.link || '') === o[0]) opt.selected = true;
            sel.appendChild(opt);
          });
        var valInput = bindText(s, 'value', '68–70%');
        valInput.disabled = !!s.link;
        if (s.link) valInput.placeholder = 'auto from deck';
        sel.addEventListener('change', function () {
          s.link = sel.value;
          valInput.disabled = !!sel.value;
          valInput.placeholder = sel.value ? 'auto from deck' : '68–70%';
        });
        r.appendChild(sel);
        var end = el('span', 'fe-end');
        end.appendChild(valInput);
        end.appendChild(removeBtn(draft.items, k, rebuild));
        r.appendChild(end);
        body.appendChild(r);
      });
      body.appendChild(addBtn('Add stat', function () {
        draft.items.push({ label: 'New stat', value: '—', link: '' }); rebuild();
      }));
    }

    if (section === 'publicUoC') {
      titleField(body, 'Card heading (e.g. Use of capital)');
      var hint = el('p', 'fe-hint');
      var sumHint = function () {
        var sum = draft.slices.reduce(function (a, s) { return a + s.pct; }, 0);
        hint.textContent = 'Slices sum to ' + (Math.round(sum * 10) / 10) + '%';
        hint.className = 'fe-hint' + (Math.abs(sum - 100) > 0.5 ? ' bad' : '');
      };
      draft.slices.forEach(function (s, k) {
        var r = el('div', 'fe-row');
        r.appendChild(bindText(s, 'label', 'Category'));
        r.appendChild(bindNum(s, 'pct', '0.1'));
        var end = el('span', 'fe-end');
        end.appendChild(el('span', 'fe-unit', '%'));
        end.appendChild(removeBtn(draft.slices, k, rebuild));
        r.appendChild(end);
        body.appendChild(r);
      });
      body.appendChild(hint);
      body.appendChild(addBtn('Add category', function () {
        draft.slices.push({ label: 'New category', pct: 0 }); rebuild();
      }));
      body.addEventListener('input', sumHint);
      sumHint();
    }
  }

  function openEditor(section) {
    editing = section;
    if (section === 'caption') draft = { caption: state.finDoc.caption };
    else if (section === 'publicStats') draft = { items: clone(pubTeaser().stats) };
    else if (section === 'publicUoC') draft = clone(pubTeaser().useOfCapital);
    else draft = clone(state.finDoc[section] || {});
    $('finm-title').textContent = FIN_TITLES[section] || 'Edit';
    $('finm-sub').textContent = FIN_SUBS[section] || '';
    $('finm-error').hidden = true;
    buildDialog(section);
    $('fin-modal').classList.add('open');
    var first = $('finm-body').querySelector('input, textarea');
    if (first) setTimeout(function () { first.focus(); }, 120);
  }

  function closeEditor() {
    editing = null;
    draft = null;
    $('fin-modal').classList.remove('open');
  }

  function collectSection(section) {
    var doc = clone(state.finDoc);
    doc.v = 2;
    if (!doc.publicTeaser) doc.publicTeaser = DEFAULT_PT();
    if (section === 'caption') doc.caption = (draft.caption || '').trim();
    else if (section === 'publicStats') doc.publicTeaser.stats = clone(draft.items);
    else if (section === 'publicUoC') doc.publicTeaser.useOfCapital = clone(draft);
    else doc[section] = clone(draft);
    if (section === 'waterfall') {
      var spent = 0;
      doc.waterfall.rows.forEach(function (w) { if (!w.computed) spent += w.amount; });
      doc.waterfall.rows.forEach(function (w) {
        if (w.computed) w.amount = Math.max(0, Math.round((doc.waterfall.retailPrice - spent) * 100) / 100);
      });
    }
    return doc;
  }

  function saveEditor() {
    if (!editing) return;
    var doc = collectSection(editing);
    $('finm-error').hidden = true;
    $('finm-save').disabled = true; $('finm-save').textContent = 'Publishing…';
    api('/admin/financials', { method: 'PUT', body: doc }).then(function (res) {
      $('finm-save').disabled = false; $('finm-save').textContent = 'Save & publish';
      if (res.status === 200 && res.data.ok) {
        state.finDoc = doc;
        closeEditor();
        renderFin();
        $('fin-status').hidden = true;
        $('fin-live').hidden = false;
        setTimeout(function () { $('fin-live').hidden = true; }, 4000);
      } else {
        $('finm-error').textContent = 'Could not publish — please check the numbers and try again.';
        $('finm-error').hidden = false;
      }
    }).catch(function () {
      $('finm-save').disabled = false; $('finm-save').textContent = 'Save & publish';
    });
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
  $('refresh').addEventListener('click', function () { loadOverview(); loadFinancials(); loadCodeEmail(); loadDeckInfo(); });

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

  // ---- investor access email template ----
  var codeEmailDefault = { subject: '', body: '' };
  function loadCodeEmail() {
    return api('/admin/code-email').then(function (res) {
      if (res.status === 200 && res.data.ok) {
        codeEmailDefault = res.data.default || codeEmailDefault;
        $('cm-subject').value = res.data.subject || codeEmailDefault.subject || '';
        $('cm-body').value = res.data.body || codeEmailDefault.body || '';
      }
    }).catch(function () {});
  }
  $('codemail-form').addEventListener('submit', function (e) {
    e.preventDefault();
    $('codemail-error').hidden = true; $('codemail-ok').hidden = true;
    api('/admin/code-email', { method: 'PUT', body: { subject: $('cm-subject').value, body: $('cm-body').value } })
      .then(function (res) {
        if (res.status === 200 && res.data.ok) { $('codemail-ok').hidden = false; }
        else { $('codemail-error').textContent = 'Could not save — please try again.'; $('codemail-error').hidden = false; }
      }).catch(function () {});
  });
  $('cm-reset').addEventListener('click', function () {
    $('cm-subject').value = codeEmailDefault.subject || '';
    $('cm-body').value = codeEmailDefault.body || '';
    $('codemail-ok').hidden = true; $('codemail-error').hidden = true;
  });
  $('cm-preview-btn').addEventListener('click', function () {
    api('/admin/code-email-preview', { method: 'POST', body: { subject: $('cm-subject').value, body: $('cm-body').value } })
      .then(function (res) {
        if (res.status === 200 && res.data.ok) {
          $('cm-preview-subject').textContent = res.data.subject || '';
          $('cm-preview-frame').srcdoc = res.data.html || '';
          $('cm-preview').style.display = 'flex';
        }
      }).catch(function () {});
  });
  $('cm-preview-close').addEventListener('click', function () { $('cm-preview').style.display = 'none'; });
  $('cm-preview').addEventListener('click', function (e) {
    if (e.target === $('cm-preview')) $('cm-preview').style.display = 'none';
  });

  // ---- pitch deck: show current + upload (signed URL → direct PUT to storage) ----
  function loadDeckInfo() {
    return api('/admin/deck-info').then(function (res) {
      var el = $('deck-current');
      if (!el) return;
      el.textContent = '';
      if (res.status === 200 && res.data && res.data.ok && res.data.url) {
        el.appendChild(document.createTextNode('Current: ' + (res.data.filename || 'pitch deck (PDF)')));
        if (res.data.uploadedAt) el.appendChild(document.createTextNode(' · ' + fmt(res.data.uploadedAt, true)));
        el.appendChild(document.createTextNode(' · '));
        var a = document.createElement('a');
        a.href = res.data.url; a.target = '_blank'; a.rel = 'noopener'; a.textContent = 'Open';
        el.appendChild(a);
      } else {
        el.textContent = 'No deck uploaded yet.';
      }
    }).catch(function () {});
  }
  $('deck-upload-btn').addEventListener('click', function () {
    var f = $('deck-file').files && $('deck-file').files[0];
    $('deck-error').hidden = true; $('deck-ok').hidden = true;
    if (!f) { $('deck-error').textContent = 'Choose a PDF first.'; $('deck-error').hidden = false; return; }
    if (f.type && f.type.indexOf('pdf') === -1) { $('deck-error').textContent = 'Please choose a PDF file.'; $('deck-error').hidden = false; return; }
    var btn = $('deck-upload-btn'); btn.disabled = true; btn.textContent = 'Uploading…';
    var fail = function () { btn.disabled = false; btn.textContent = 'Upload deck'; $('deck-error').textContent = 'Upload failed — please try again.'; $('deck-error').hidden = false; };
    api('/admin/deck-upload-url').then(function (res) {
      if (res.status !== 200 || !res.data || !res.data.ok || !res.data.signedUrl) { fail(); return; }
      fetch(res.data.signedUrl, { method: 'PUT', headers: { 'content-type': 'application/pdf', 'x-upsert': 'true' }, body: f })
        .then(function (up) {
          if (!up || !up.ok) { fail(); return; }
          api('/admin/deck-saved', { method: 'POST', body: { filename: f.name } }).then(function () {
            btn.disabled = false; btn.textContent = 'Upload deck';
            $('deck-ok').hidden = false; $('deck-file').value = '';
            loadDeckInfo();
          });
        }).catch(function () { fail(); });
    }).catch(function () { fail(); });
  });

  $('add-form').addEventListener('submit', function (e) {
    e.preventDefault();
    $('add-error').hidden = true;
    var name = $('add-name').value.trim(), email = $('add-email').value.trim(), firm = $('add-firm').value.trim();
    if (!name || !email) { $('add-error').textContent = 'Name and email are required.'; $('add-error').hidden = false; return; }
    api('/admin/grant', { method: 'POST', body: { email: email, name: name, firm: firm } }).then(function (res) {
      if (res.status === 200 && res.data.ok) {
        $('add-name').value = ''; $('add-email').value = ''; $('add-firm').value = '';
        deliverCode(email, res);
      } else {
        $('add-error').textContent = 'Could not add: ' + (res.data && res.data.reason || 'error');
        $('add-error').hidden = false;
      }
    }).catch(function () {});
  });

  // ---- launch list ----
  $('copy-emails').addEventListener('click', function () {
    var emails = (state.launchEmails || []).join(', ');
    if (!emails) return;
    navigator.clipboard && navigator.clipboard.writeText(emails).then(function () {
      $('copied-ok').hidden = false;
      setTimeout(function () { $('copied-ok').hidden = true; }, 2500);
    });
  });
  $('launch-add-form').addEventListener('submit', function (e) {
    e.preventDefault();
    var email = $('launch-add-email').value.trim();
    if (!email) return;
    api('/admin/launch-add', { method: 'POST', body: { email: email } }).then(function (res) {
      if (res.status === 200 && res.data.ok) { $('launch-add-email').value = ''; loadOverview(); }
    }).catch(function () {});
  });

  // ---- bugs & change requests ----
  var bugImage = null;
  $('bug-file').addEventListener('change', function () {
    var f = $('bug-file').files[0];
    bugImage = null;
    $('bug-file-name').textContent = '';
    if (!f) return;
    if (!/^image\//.test(f.type)) { $('bug-file-name').textContent = 'Images only, please.'; return; }
    if (f.size > 4_000_000) { $('bug-file-name').textContent = 'That image is over 4 MB — try a smaller screenshot.'; return; }
    var reader = new FileReader();
    reader.onload = function () {
      bugImage = { name: f.name, type: f.type, dataBase64: String(reader.result).split(',')[1] };
      $('bug-file-name').textContent = '📎 ' + f.name;
    };
    reader.readAsDataURL(f);
  });
  $('bug-submit').addEventListener('click', function () {
    $('bug-error').hidden = true; $('bug-ok').hidden = true;
    var message = $('bug-text').value.trim();
    if (!message) { $('bug-error').textContent = 'Describe the issue first.'; $('bug-error').hidden = false; return; }
    $('bug-submit').disabled = true; $('bug-submit').textContent = 'Sending…';
    api('/admin/bug-report', { method: 'POST', body: { message: message, image: bugImage }, timeoutMs: 30000 })
      .then(function (res) {
        $('bug-submit').disabled = false; $('bug-submit').textContent = 'Submit';
        if (res.status === 200 && res.data.ok) {
          $('bug-text').value = ''; $('bug-file').value = ''; $('bug-file-name').textContent = '';
          bugImage = null;
          $('bug-ok').hidden = false;
          setTimeout(function () { $('bug-ok').hidden = true; }, 4000);
          loadOverview();
        } else {
          $('bug-error').textContent = 'Could not send — please try again.';
          $('bug-error').hidden = false;
        }
      }).catch(function () {
        $('bug-submit').disabled = false; $('bug-submit').textContent = 'Submit';
      });
  });

  $('finm-save').addEventListener('click', saveEditor);
  $('caption-edit').addEventListener('click', function () { openEditor('caption'); });
  document.querySelectorAll('[data-finm-close]').forEach(function (b) {
    b.addEventListener('click', closeEditor);
  });
  $('fin-modal').addEventListener('click', function (e) {
    if (e.target === $('fin-modal')) closeEditor();
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && editing) closeEditor();
  });

  var savedKey = readKey();
  if (savedKey) unlock(savedKey);
  else { $('gate').hidden = false; }
})();
