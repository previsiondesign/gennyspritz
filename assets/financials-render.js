/* ============================================================
   renderFinancials(doc) -> HTMLElement
   Renders the financials document using the existing .fin-*
   styles in brand.css (same markup as the public teaser block,
   geometry computed from the data). Shared by the investor page
   and the dashboard's live preview.
   ============================================================ */
(function () {
  'use strict';

  var WF_COLORS = ['var(--sage-deep)', 'var(--taupe)', 'var(--coral)', 'var(--forest)'];
  var DONUT_COLORS = ['var(--forest)', 'var(--sage-deep)', 'var(--taupe)', 'var(--honeysuckle)', 'var(--coral)'];

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  function money(n) { return '$' + Number(n).toFixed(2); }
  function intFmt(n) { return Number(n).toLocaleString('en-US'); }

  function renderYears(years) {
    var wrap = el('div', 'fin-years');
    years.forEach(function (y) {
      var d = el('div', 'fin-year');
      d.appendChild(el('span', null, y.label));
      d.appendChild(el('strong', null, Math.round(y.marginPct) + '%'));
      d.appendChild(el('em', null, intFmt(y.cases) + ' cases'));
      wrap.appendChild(d);
    });
    return wrap;
  }

  function renderWaterfall(wf) {
    var box = el('div', 'fin-mini');
    box.appendChild(el('h4', null, 'Where the ' + money(wf.retailPrice) + ' goes · 4-pack'));
    var ul = el('ul', 'wf');
    var max = Math.max.apply(null, wf.rows.map(function (r) { return r.amount; })) || 1;
    wf.rows.forEach(function (r, i) {
      var li = el('li');
      li.appendChild(el('span', null, r.label));
      var bar = el('span', 'wf-bar');
      var color = r.computed ? 'var(--forest)' : WF_COLORS[i % WF_COLORS.length];
      bar.style.width = Math.max(4, Math.round(r.amount / max * 100)) + '%';
      bar.style.background = color;
      li.appendChild(bar);
      li.appendChild(el('b', null, money(r.amount)));
      ul.appendChild(li);
    });
    box.appendChild(ul);
    return box;
  }

  function renderCogs(cogs) {
    var box = el('div', 'fin-mini');
    box.appendChild(el('h4', null, 'COGS breakdown · per can'));
    var flex = el('div', 'fin-donut');

    var NS = 'http://www.w3.org/2000/svg';
    var svg = document.createElementNS(NS, 'svg');
    svg.setAttribute('viewBox', '0 0 120 120');
    svg.setAttribute('role', 'img');
    svg.setAttribute('aria-label', 'COGS breakdown: ' +
      cogs.slices.map(function (s) { return s.label + ' ' + s.pct + '%'; }).join(', '));
    var g = document.createElementNS(NS, 'g');
    g.setAttribute('transform', 'rotate(-90 60 60)');
    g.setAttribute('fill', 'none');
    g.setAttribute('stroke-width', '22');
    var C = 2 * Math.PI * 50;
    var total = cogs.slices.reduce(function (a, s) { return a + s.pct; }, 0) || 100;
    var offset = 0;
    cogs.slices.forEach(function (s, i) {
      var c = document.createElementNS(NS, 'circle');
      c.setAttribute('cx', '60'); c.setAttribute('cy', '60'); c.setAttribute('r', '50');
      c.setAttribute('stroke', DONUT_COLORS[i % DONUT_COLORS.length]);
      var len = s.pct / total * C;
      c.setAttribute('stroke-dasharray', len.toFixed(1) + ' ' + (C - len).toFixed(1));
      c.setAttribute('stroke-dashoffset', (-offset).toFixed(1));
      offset += len;
      g.appendChild(c);
    });
    svg.appendChild(g);
    flex.appendChild(svg);

    var ul = el('ul');
    cogs.slices.forEach(function (s, i) {
      var li = el('li');
      var dot = el('span', 'dot');
      dot.style.background = DONUT_COLORS[i % DONUT_COLORS.length];
      li.appendChild(dot);
      li.appendChild(document.createTextNode(s.label));
      li.appendChild(el('b', null, Math.round(s.pct) + '%'));
      ul.appendChild(li);
    });
    flex.appendChild(ul);
    box.appendChild(flex);
    return box;
  }

  function renderBenchmarks(bm) {
    var box = el('div', 'fin-mini');
    box.appendChild(el('h4', null, 'Gross margin vs category'));
    var ul = el('ul', 'hbars');
    var max = Math.max.apply(null, bm.rows.map(function (r) { return r.pct; })) || 1;
    bm.rows.forEach(function (r) {
      var li = el('li', r.highlight ? 'hi' : null);
      var top = el('div', 'hbars-top');
      top.appendChild(el('span', null, r.label));
      top.appendChild(el('b', null, Math.round(r.pct) + '%'));
      li.appendChild(top);
      var track = el('div', 'track');
      var fill = el('div', 'fill');
      fill.style.width = Math.round(r.pct / (max * 1.1) * 100) + '%';
      track.appendChild(fill);
      li.appendChild(track);
      ul.appendChild(li);
    });
    box.appendChild(ul);
    return box;
  }

  window.renderFinancials = function (doc) {
    var root = el('div', 'fin-content');
    root.appendChild(renderYears(doc.years || []));
    var grid = el('div', 'fin-grid3');
    if (doc.waterfall) grid.appendChild(renderWaterfall(doc.waterfall));
    if (doc.cogs) grid.appendChild(renderCogs(doc.cogs));
    if (doc.benchmarks) grid.appendChild(renderBenchmarks(doc.benchmarks));
    root.appendChild(grid);
    return root;
  };
})();
