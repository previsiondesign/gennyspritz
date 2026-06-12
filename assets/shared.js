/* ============================================================
   GENNY Spritz — shared interactions
   Works across all three variants. Every hook is guarded so a
   page can omit any feature without errors.
   ============================================================ */
(function () {
  'use strict';

  /* ---- current year in footers ---- */
  document.querySelectorAll('[data-year]').forEach(function (el) {
    el.textContent = new Date().getFullYear();
  });

  /* ---- header scrolled state ---- */
  var header = document.querySelector('[data-header]');
  if (header) {
    var onScroll = function () {
      header.classList.toggle('scrolled', window.scrollY > 40);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  /* ---- mobile nav toggle ---- */
  var navToggle = document.querySelector('[data-nav-toggle]');
  var nav = document.querySelector('[data-nav]');
  if (navToggle && nav) {
    var closeNav = function () {
      nav.classList.remove('open');
      navToggle.setAttribute('aria-expanded', 'false');
      document.body.classList.remove('nav-open');
    };
    navToggle.addEventListener('click', function () {
      var open = nav.classList.toggle('open');
      navToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
      document.body.classList.toggle('nav-open', open);
    });
    nav.querySelectorAll('a').forEach(function (a) {
      a.addEventListener('click', closeNav);
    });
    // backdrop scrim: tap outside the panel (or press Esc) to close.
    // Appended inside the header so it shares the panel's stacking context.
    var scrim = document.createElement('div');
    scrim.className = 'nav-scrim';
    (header || document.body).appendChild(scrim);
    scrim.addEventListener('click', closeNav);
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && nav.classList.contains('open')) closeNav();
    });
    // test/screenshot hook: ?navopen opens the menu in the scrolled state
    if (/[?&]navopen/.test(location.search)) {
      nav.classList.add('open');
      document.body.classList.add('nav-open');
      if (header) header.classList.add('scrolled');
    }
  }

  /* ---- scroll reveal ---- */
  var reveals = document.querySelectorAll('.reveal');
  // test/screenshot hook: ?shot reveals everything immediately
  if (/[?&]shot/.test(location.search)) {
    reveals.forEach(function (el) { el.classList.add('in'); });
    reveals = [];
  }
  if (reveals.length && 'IntersectionObserver' in window) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
      });
    }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });
    reveals.forEach(function (el) { io.observe(el); });
  } else {
    reveals.forEach(function (el) { el.classList.add('in'); });
  }

  /* ---- gated investor-deck modal ---- */
  var modal = document.querySelector('[data-modal]');
  if (modal) {
    var openModal = function () {
      modal.classList.add('open');
      document.body.style.overflow = 'hidden';
      var first = modal.querySelector('input');
      if (first) setTimeout(function () { first.focus(); }, 120);
    };
    var closeModal = function () {
      modal.classList.remove('open');
      document.body.style.overflow = '';
    };
    document.querySelectorAll('[data-open-deck]').forEach(function (b) {
      b.addEventListener('click', function (e) { e.preventDefault(); openModal(); });
    });
    modal.addEventListener('click', function (e) {
      if (e.target === modal || e.target.hasAttribute('data-close')) closeModal();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && modal.classList.contains('open')) closeModal();
    });
  }

  /* ---- forms: validate, success state, mailto fallback ---- */
  var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  document.querySelectorAll('.js-form').forEach(function (form) {
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var email = form.querySelector('input[type="email"]');
      if (email && !EMAIL_RE.test(email.value.trim())) {
        email.focus();
        email.setCustomValidity('Please enter a valid email');
        email.reportValidity();
        setTimeout(function () { email.setCustomValidity(''); }, 1500);
        return;
      }
      // Build a mailto fallback so a real message is actually sent in the prototype
      var to = form.getAttribute('data-mailto') || 'info@gennyspritz.com';
      var subject = form.getAttribute('data-subject') || 'genny — website inquiry';
      var lines = [];
      form.querySelectorAll('input, textarea').forEach(function (f) {
        if (f.type === 'submit' || f.type === 'button') return;
        var label = f.getAttribute('data-label') || f.name || f.placeholder || 'Field';
        if (f.value.trim()) lines.push(label + ': ' + f.value.trim());
      });
      var body = lines.join('\n') + '\n\n— sent from the genny website';
      var href = 'mailto:' + to + '?subject=' + encodeURIComponent(subject) +
                 '&body=' + encodeURIComponent(body);
      var mailtoFallback = function () {
        form.classList.add('ok');
        try { window.location.href = href; } catch (err) { /* no-op */ }
      };

      // Launch-list signups go to the backend (tracked in the dashboard);
      // mailto only if the API is missing or unreachable.
      if (form.getAttribute('data-api') === 'launch-list' &&
          window.GennyAPI && window.GennyAPI.configured) {
        var emailField = form.querySelector('input[type="email"]');
        window.GennyAPI.call('/request', {
          method: 'POST',
          body: { kind: 'launch', email: emailField ? emailField.value.trim() : '' },
        }).then(function (res) {
          if (res.status === 200 && res.data && res.data.ok) form.classList.add('ok');
          else mailtoFallback();
        });
        return;
      }

      // Access requests go to the secure backend (lands in Natasha's
      // dashboard); mailto only if the API is missing or unreachable.
      if (form.getAttribute('data-api') === 'request-access' &&
          window.GennyAPI && window.GennyAPI.configured) {
        var val = function (n) {
          var f = form.querySelector('[name="' + n + '"]');
          return f ? f.value.trim() : '';
        };
        window.GennyAPI.call('/request', {
          method: 'POST',
          body: { kind: 'access', name: val('name'), email: val('email'),
                  firm: val('firm'), note: val('note') },
        }).then(function (res) {
          if (res.status === 200 && res.data && res.data.ok) form.classList.add('ok');
          else mailtoFallback();
        });
        return;
      }
      mailtoFallback();
    });
  });
})();
