/* smooth scroll offset for fixed nav */
(function () {
  'use strict';

  /* ── Mobile nav toggle ─────────────────────────────────── */
  const toggle = document.getElementById('navToggle');
  const nav    = document.getElementById('navMenu');

  if (toggle && nav) {
    toggle.addEventListener('click', () => {
      nav.classList.toggle('open');
      toggle.setAttribute('aria-expanded', nav.classList.contains('open'));
    });

    /* close menu when a link is clicked */
    nav.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', () => nav.classList.remove('open'));
    });
  }

  /* ── Active nav link on scroll ─────────────────────────── */
  const sections = document.querySelectorAll('section[id]');
  const navLinks = document.querySelectorAll('.navbar-nav a[href^="#"]');

  function onScroll() {
    const scrollY = window.scrollY + 100;

    sections.forEach(sec => {
      if (scrollY >= sec.offsetTop && scrollY < sec.offsetTop + sec.offsetHeight) {
        navLinks.forEach(l => l.classList.remove('active'));
        const active = document.querySelector(`.navbar-nav a[href="#${sec.id}"]`);
        if (active) active.classList.add('active');
      }
    });
  }

  window.addEventListener('scroll', onScroll, { passive: true });

  /* ── Publication year filter ────────────────────────────── */
  const filterBtns = document.querySelectorAll('.filter-btn');
  const pubItems   = document.querySelectorAll('.pub-item[data-year]');

  filterBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      filterBtns.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');

      const year = btn.dataset.year;

      pubItems.forEach(item => {
        if (year === 'all' || item.dataset.year === year) {
          item.style.display = '';
        } else {
          item.style.display = 'none';
        }
      });
    });
  });

  /* ── Contact form (no-backend demo) ────────────────────── */
  const form = document.getElementById('contactForm');
  if (form) {
    form.addEventListener('submit', e => {
      e.preventDefault();
      const btn = form.querySelector('button[type="submit"]');
      btn.textContent = '✓ Message sent!';
      btn.disabled = true;
      btn.style.background = '#27ae60';
      form.reset();
    });
  }

  /* ── Fade-in on scroll (IntersectionObserver) ───────────── */
  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.1 });

    document.querySelectorAll('.research-card, .person-card, .news-card, .pub-item')
      .forEach(el => {
        el.style.opacity = '0';
        el.style.transform = 'translateY(20px)';
        el.style.transition = 'opacity .4s ease, transform .4s ease';
        observer.observe(el);
      });

    document.addEventListener('DOMContentLoaded', () => {}, false);
  }

  /* helper: add .visible class */
  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.research-card, .person-card, .news-card, .pub-item')
      .forEach(el => {
        const style = el.style;
        /* reset styles once CSS transition fires */
        el.addEventListener('transitionend', () => {
          style.opacity = '';
          style.transform = '';
          style.transition = '';
        }, { once: true });
      });
  });

  /* patch .visible */
  const style = document.createElement('style');
  style.textContent = '.research-card.visible,.person-card.visible,.news-card.visible,.pub-item.visible{opacity:1!important;transform:none!important}';
  document.head.appendChild(style);

})();
