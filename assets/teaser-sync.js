/* ============================================================
   Homepage investor teaser — kept in sync with the dashboard deck.
   Pulls the PUBLIC teaser (3 stat values + use-of-capital split)
   from the backend and repaints the static markup. Two of the
   stats are derived server-side from the deck, so a deck edit
   flows straight through here. If the backend is unreachable or
   not configured, the static HTML stays exactly as authored.
   ============================================================ */
(function () {
  'use strict';
  if (!window.GennyAPI || !GennyAPI.configured) return;

  var row = document.querySelector('[data-teaser-row]');
  var card = document.querySelector('[data-capital-card]');
  if (!row && !card) return;

  // Palette for the use-of-capital donut. NOTE: this sits on the dark forest
  // investor band, so --forest is deliberately omitted (it vanishes against it).
  var COLORS = ['var(--honeysuckle)', 'var(--coral)', 'var(--sage-deep)', 'var(--taupe)',
                'var(--cucumber)', 'var(--rhubarb)', 'var(--sage)', '#c9a96a'];
  var SVGNS = 'http://www.w3.org/2000/svg';

  function pct(n) {
    var v = Math.round(Number(n) * 10) / 10;
    return (Number.isFinite(v) ? String(v).replace(/\.0$/, '') : '0') + '%';
  }

  function paintStats(stats) {
    if (!row || !stats || !stats.length) return;
    row.textContent = '';
    stats.forEach(function (s) {
      var d = document.createElement('div');
      d.className = 'teaser';
      var strong = document.createElement('strong');
      strong.textContent = s.value;
      var span = document.createElement('span');
      span.textContent = s.label;
      d.appendChild(strong);
      d.appendChild(span);
      row.appendChild(d);
    });
  }

  function paintCapital(uoc) {
    if (!card || !uoc || !uoc.slices || !uoc.slices.length) return;
    var slices = uoc.slices;
    var total = slices.reduce(function (a, s) { return a + (Number(s.pct) || 0); }, 0) || 100;

    var h3 = card.querySelector('h3');
    if (h3 && uoc.title) h3.textContent = uoc.title;

    var g = card.querySelector('svg.donut g');
    if (g) {
      while (g.firstChild) g.removeChild(g.firstChild);
      var C = 2 * Math.PI * 54;        // r = 54 (matches the markup)
      var offset = 0;
      slices.forEach(function (s, i) {
        var len = (Number(s.pct) || 0) / total * C;
        var c = document.createElementNS(SVGNS, 'circle');
        c.setAttribute('cx', '60');
        c.setAttribute('cy', '60');
        c.setAttribute('r', '54');
        c.setAttribute('stroke', COLORS[i % COLORS.length]);
        c.setAttribute('stroke-dasharray', len.toFixed(1) + ' ' + (C - len).toFixed(1));
        c.setAttribute('stroke-dashoffset', (-offset).toFixed(1));
        g.appendChild(c);
        offset += len;
      });
    }

    var legend = card.querySelector('.capital-legend');
    if (legend) {
      legend.textContent = '';
      slices.forEach(function (s, i) {
        var li = document.createElement('li');
        var dot = document.createElement('span');
        dot.className = 'dot';
        dot.style.background = COLORS[i % COLORS.length];
        li.appendChild(dot);
        li.appendChild(document.createTextNode(s.label));
        var b = document.createElement('b');
        b.textContent = pct(s.pct);
        li.appendChild(b);
        legend.appendChild(li);
      });
    }

    var svg = card.querySelector('svg.donut');
    if (svg) {
      svg.setAttribute('aria-label', (uoc.title || 'Use of capital') + ': ' +
        slices.map(function (s) { return s.label + ' ' + pct(s.pct); }).join(', '));
    }
  }

  GennyAPI.call('/financials', { method: 'GET' }).then(function (res) {
    if (res.status !== 200 || !res.data || !res.data.ok || !res.data.teaser) return;
    try {
      paintStats(res.data.teaser.stats);
      paintCapital(res.data.teaser.useOfCapital);
    } catch (e) { /* keep the static markup */ }
  });
})();
