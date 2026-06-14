/* ============================================================
   renderFinancials(doc, opts) -> HTMLElement     (financials v2)
   Renders the financials document with the .fin-* styles in
   brand.css. Sections (all optional except years): topStats,
   years, narrative, waterfall, cogs, benchmarks, evolution,
   costCompress, assumptions. Percentages render to 0.1%.
   opts.onEdit(section): founder dashboard hook — adds a pencil
   to every card. The investor page passes no opts.
   ============================================================ */
(function () {
  'use strict';

  var WF_COLORS = ['var(--sage-deep)', 'var(--taupe)', 'var(--coral)', 'var(--forest)'];
  var SERIES_COLORS = ['var(--coral)', 'var(--sage-deep)', 'var(--honeysuckle)', 'var(--taupe)', 'var(--forest)',
                       'var(--rhubarb)', 'var(--cucumber)', '#8da3b8'];
  var DONUT_COLORS = ['var(--forest)', 'var(--coral)', 'var(--sage-deep)', 'var(--honeysuckle)', 'var(--taupe)',
                      'var(--rhubarb)', 'var(--cucumber)', '#8da3b8'];

  function el(tag, cls, text) {
    var n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  }
  function svgEl(tag, attrs) {
    var n = document.createElementNS('http://www.w3.org/2000/svg', tag);
    for (var k in attrs) n.setAttribute(k, attrs[k]);
    return n;
  }
  function pct(n) { return Number(n).toFixed(1) + '%'; }
  function money(n) { return '$' + Number(n).toFixed(2); }
  function intFmt(n) { return Number(n).toLocaleString('en-US'); }

  // v1 documents (pre-redesign) get lifted into the v2 shape
  function normalize(doc) {
    if (!doc) return doc;
    if (doc.v === 2 || (doc.years && doc.years.items)) return doc;
    return {
      v: 2,
      caption: doc.caption || '',
      years: { items: (doc.years || []).map(function (y) { return { label: y.label, marginPct: y.marginPct, cases: y.cases, revenue: '', delta: '' }; }) },
      waterfall: doc.waterfall ? Object.assign({ title: 'Price waterfall per 4-pack' }, doc.waterfall) : null,
      cogs: doc.cogs ? { title: 'COGS breakdown per can', slices: doc.cogs.slices } : null,
      benchmarks: doc.benchmarks ? { title: 'Gross margin vs. category benchmarks', rows: doc.benchmarks.rows } : null,
    };
  }

  function card(title, section, opts, wide) {
    var box = el('div', 'fin-mini' + (wide ? ' fin-wide' : ''));
    if (title) box.appendChild(el('h4', null, title));
    if (typeof opts.onEdit === 'function') box.appendChild(pencil(section, title || section, opts));
    return box;
  }
  function pencil(section, label, opts) {
    var b = el('button', 'fin-edit-btn');
    b.type = 'button';
    b.setAttribute('aria-label', 'Edit ' + label);
    b.title = 'Edit ' + label;
    b.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ' +
      'stroke-linecap="round" stroke-linejoin="round"><path d="M17 3a2.8 2.8 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5z"/></svg>';
    b.addEventListener('click', function () { opts.onEdit(section); });
    return b;
  }

  // ---------- sections ----------
  function renderTopStats(ts, opts) {
    var wrap = el('div', 'fin-stats');
    ts.items.forEach(function (s) {
      var d = el('div', 'fin-stat' + (s.highlight ? ' hi' : ''));
      d.appendChild(el('span', 'fin-stat-label', s.label));
      d.appendChild(el('strong', null, s.value));
      if (s.sub) d.appendChild(el('em', null, s.sub));
      wrap.appendChild(d);
    });
    if (typeof opts.onEdit === 'function') {
      var holder = el('div', 'fin-stats-wrap');
      holder.appendChild(wrap);
      holder.appendChild(pencil('topStats', 'the headline stats', opts));
      return holder;
    }
    return wrap;
  }

  function renderYears(years, opts) {
    var wrap = el('div', 'fin-years');
    years.items.forEach(function (y) {
      var d = el('div', 'fin-year');
      d.appendChild(el('span', null, y.label));
      d.appendChild(el('strong', null, pct(y.marginPct)));
      d.appendChild(el('em', null, intFmt(y.cases) + ' cases'));
      if (y.revenue) d.appendChild(el('em', 'fin-year-rev', y.revenue));
      if (y.delta) d.appendChild(el('em', 'fin-year-delta', y.delta));
      if (typeof opts.onEdit === 'function') d.appendChild(pencil('years', 'the year-by-year figures', opts));
      wrap.appendChild(d);
    });
    return wrap;
  }

  function renderNarrative(n, opts) {
    var box = card(n.title, 'narrative', opts, true);
    box.classList.add('fin-narrative');
    n.paragraphs.forEach(function (p) { box.appendChild(el('p', null, p)); });
    return box;
  }

  function renderWaterfall(wf, opts) {
    var box = card(wf.title || ('Where the ' + money(wf.retailPrice) + ' goes'), 'waterfall', opts);
    var ul = el('ul', 'wf');
    var max = Math.max.apply(null, wf.rows.map(function (r) { return r.amount; })) || 1;
    wf.rows.forEach(function (r, i) {
      var li = el('li');
      li.appendChild(el('span', null, r.label));
      var bar = el('span', 'wf-bar');
      bar.style.width = Math.max(4, Math.round(r.amount / max * 100)) + '%';
      bar.style.background = r.computed ? 'var(--forest)' : WF_COLORS[i % WF_COLORS.length];
      li.appendChild(bar);
      li.appendChild(el('b', null, money(r.amount)));
      ul.appendChild(li);
    });
    box.appendChild(ul);
    box.appendChild(el('p', 'fin-note', 'Retail price ' + money(wf.retailPrice) + ' per 4-pack'));
    return box;
  }

  function renderCogs(cogs, opts) {
    var box = card(cogs.title, 'cogs', opts);
    var flex = el('div', 'fin-donut');
    // viewBox padded by 4 so the 22-wide stroke (outer radius 61) isn't clipped at the edges
    var svg = svgEl('svg', { viewBox: '-4 -4 128 128', role: 'img',
      'aria-label': cogs.slices.map(function (s) { return s.label + ' ' + pct(s.pct); }).join(', ') });
    var g = svgEl('g', { transform: 'rotate(-90 60 60)', fill: 'none', 'stroke-width': '22' });
    var C = 2 * Math.PI * 50;
    var total = cogs.slices.reduce(function (a, s) { return a + s.pct; }, 0) || 100;
    var offset = 0;
    cogs.slices.forEach(function (s, i) {
      var len = s.pct / total * C;
      g.appendChild(svgEl('circle', { cx: 60, cy: 60, r: 50,
        stroke: DONUT_COLORS[i % DONUT_COLORS.length],
        'stroke-dasharray': len.toFixed(1) + ' ' + (C - len).toFixed(1),
        'stroke-dashoffset': (-offset).toFixed(1) }));
      offset += len;
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
      li.appendChild(el('b', null, pct(s.pct)));
      ul.appendChild(li);
    });
    flex.appendChild(ul);
    box.appendChild(flex);
    return box;
  }

  function renderBenchmarks(bm, opts) {
    var box = card(bm.title, 'benchmarks', opts);
    var ul = el('ul', 'hbars');
    var max = Math.max.apply(null, bm.rows.map(function (r) { return r.pct; })) || 1;
    bm.rows.forEach(function (r) {
      var li = el('li', r.highlight ? 'hi' : null);
      var top = el('div', 'hbars-top');
      top.appendChild(el('span', null, r.label));
      top.appendChild(el('b', null, pct(r.pct)));
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

  // dual-axis line chart: $ lines (fob, cogs) + dashed margin % on right axis
  function renderEvolution(ev, opts) {
    var box = card(ev.title, 'evolution', opts, true);
    if (ev.sub) box.appendChild(el('p', 'fin-sub', ev.sub));
    var W = 560, H = 210, padL = 44, padR = 46, padT = 14, padB = 30;
    var rows = ev.rows;
    var maxD = Math.max.apply(null, rows.map(function (r) { return Math.max(r.fob, r.cogs); })) * 1.15;
    var minP = Math.min.apply(null, rows.map(function (r) { return r.marginPct; })) - 4;
    var maxP = Math.max.apply(null, rows.map(function (r) { return r.marginPct; })) + 4;
    var x = function (i) { return padL + i * (W - padL - padR) / Math.max(1, rows.length - 1); };
    var yD = function (v) { return H - padB - (v / maxD) * (H - padT - padB); };
    var yP = function (v) { return H - padB - ((v - minP) / (maxP - minP)) * (H - padT - padB); };
    var svg = svgEl('svg', { viewBox: '0 0 ' + W + ' ' + H, class: 'fin-chart', role: 'img', 'aria-label': ev.title });
    [0, 0.25, 0.5, 0.75, 1].forEach(function (f) {
      var v = maxD * f;
      svg.appendChild(svgEl('line', { x1: padL, x2: W - padR, y1: yD(v), y2: yD(v), stroke: 'var(--line)', 'stroke-width': 1 }));
      var t = svgEl('text', { x: padL - 6, y: yD(v) + 3, 'text-anchor': 'end', class: 'fin-axis' });
      t.textContent = '$' + v.toFixed(0);
      svg.appendChild(t);
    });
    [minP + 1, (minP + maxP) / 2, maxP - 1].forEach(function (v) {
      var t = svgEl('text', { x: W - padR + 6, y: yP(v) + 3, 'text-anchor': 'start', class: 'fin-axis right' });
      t.textContent = v.toFixed(0) + '%';
      svg.appendChild(t);
    });
    var series = [
      { key: 'fob', color: 'var(--forest)', y: function (r) { return yD(r.fob); }, dash: '' },
      { key: 'cogs', color: 'var(--coral)', y: function (r) { return yD(r.cogs); }, dash: '' },
      { key: 'marginPct', color: 'var(--honeysuckle)', y: function (r) { return yP(r.marginPct); }, dash: '5 4' },
    ];
    series.forEach(function (s) {
      svg.appendChild(svgEl('polyline', {
        points: rows.map(function (r, i) { return x(i) + ',' + s.y(r); }).join(' '),
        fill: 'none', stroke: s.color, 'stroke-width': 2.4,
        'stroke-dasharray': s.dash, 'stroke-linecap': 'round', 'stroke-linejoin': 'round',
      }));
      rows.forEach(function (r, i) {
        svg.appendChild(svgEl('circle', { cx: x(i), cy: s.y(r), r: 3.4, fill: s.color }));
      });
    });
    rows.forEach(function (r, i) {
      var t = svgEl('text', { x: x(i), y: H - 8, 'text-anchor': 'middle', class: 'fin-axis' });
      t.textContent = r.label;
      svg.appendChild(t);
    });
    box.appendChild(svg);
    var legend = el('ul', 'fin-legend');
    [['FOB price per 4-pack', 'var(--forest)'], ['COGS per 4-pack', 'var(--coral)'],
     ['Gross margin % (right axis)', 'var(--honeysuckle)']].forEach(function (li) {
      var item = el('li');
      var dot = el('span', 'dot'); dot.style.background = li[1];
      item.appendChild(dot); item.appendChild(document.createTextNode(li[0]));
      legend.appendChild(item);
    });
    box.appendChild(legend);
    return box;
  }

  // stacked bars per year
  function renderCostCompress(cc, opts) {
    var box = card(cc.title, 'costCompress', opts, true);
    if (cc.sub) box.appendChild(el('p', 'fin-sub', cc.sub));
    var W = 560, H = 200, padL = 44, padR = 12, padT = 12, padB = 30;
    var totals = cc.rows.map(function (r) { return r.values.reduce(function (a, b) { return a + b; }, 0); });
    var maxT = Math.max.apply(null, totals) * 1.12;
    var bw = Math.min(56, (W - padL - padR) / cc.rows.length * 0.55);
    var svg = svgEl('svg', { viewBox: '0 0 ' + W + ' ' + H, class: 'fin-chart', role: 'img', 'aria-label': cc.title });
    [0, 0.5, 1].forEach(function (f) {
      var v = maxT * f;
      var y = H - padB - (v / maxT) * (H - padT - padB);
      svg.appendChild(svgEl('line', { x1: padL, x2: W - padR, y1: y, y2: y, stroke: 'var(--line)', 'stroke-width': 1 }));
      var t = svgEl('text', { x: padL - 6, y: y + 3, 'text-anchor': 'end', class: 'fin-axis' });
      t.textContent = '$' + v.toFixed(2);
      svg.appendChild(t);
    });
    cc.rows.forEach(function (r, i) {
      var cx = padL + (i + 0.5) * (W - padL - padR) / cc.rows.length;
      var yCursor = H - padB;
      r.values.forEach(function (v, k) {
        var h = (v / maxT) * (H - padT - padB);
        yCursor -= h;
        svg.appendChild(svgEl('rect', { x: cx - bw / 2, y: yCursor, width: bw, height: Math.max(0, h - 1),
          fill: SERIES_COLORS[k % SERIES_COLORS.length], rx: 1.5 }));
      });
      var t = svgEl('text', { x: cx, y: H - 8, 'text-anchor': 'middle', class: 'fin-axis' });
      t.textContent = r.label;
      svg.appendChild(t);
    });
    box.appendChild(svg);
    var legend = el('ul', 'fin-legend');
    cc.components.forEach(function (c, k) {
      var item = el('li');
      var dot = el('span', 'dot'); dot.style.background = SERIES_COLORS[k % SERIES_COLORS.length];
      item.appendChild(dot); item.appendChild(document.createTextNode(c));
      legend.appendChild(item);
    });
    box.appendChild(legend);
    return box;
  }

  function renderAssumptions(as, opts) {
    var box = card(as.title, 'assumptions', opts);
    box.classList.add('fin-assume');
    var ul = el('ul');
    as.rows.forEach(function (r) {
      var li = el('li');
      li.appendChild(el('span', null, r.label));
      li.appendChild(el('b', null, r.value));
      ul.appendChild(li);
    });
    box.appendChild(ul);
    return box;
  }

  window.renderFinancials = function (rawDoc, opts) {
    opts = opts || {};
    var doc = normalize(rawDoc);
    var root = el('div', 'fin-content');
    if (doc.topStats && doc.topStats.items && doc.topStats.items.length) {
      root.appendChild(renderTopStats(doc.topStats, opts));
    }
    if (doc.years && doc.years.items) root.appendChild(renderYears(doc.years, opts));
    if (doc.narrative && doc.narrative.paragraphs && doc.narrative.paragraphs.length) {
      root.appendChild(renderNarrative(doc.narrative, opts));
    }
    var grid = el('div', 'fin-grid3');
    if (doc.waterfall) grid.appendChild(renderWaterfall(doc.waterfall, opts));
    if (doc.cogs) grid.appendChild(renderCogs(doc.cogs, opts));
    if (doc.benchmarks) grid.appendChild(renderBenchmarks(doc.benchmarks, opts));
    root.appendChild(grid);
    var grid2 = el('div', 'fin-grid2');
    if (doc.evolution && doc.evolution.rows) grid2.appendChild(renderEvolution(doc.evolution, opts));
    if (doc.costCompress && doc.costCompress.rows) grid2.appendChild(renderCostCompress(doc.costCompress, opts));
    if (grid2.children.length) root.appendChild(grid2);
    if (doc.assumptions && doc.assumptions.rows) root.appendChild(renderAssumptions(doc.assumptions, opts));
    return root;
  };
})();
