/* ── MMU NLP Group – Publications auto-loader ────────────────────────
 * Fetches the 20 most-recent publications for every group member from
 * the OpenAlex open-metadata API and renders them live on the page.
 * OpenAlex docs: https://docs.openalex.org
 * ───────────────────────────────────────────────────────────────────── */
(function () {
  'use strict';

  /* ── Configuration ───────────────────────────────────────────────── */

  /** Full names used to search the OpenAlex author index. */
  const AUTHORS = [
    'Matthew Shardlow',
    'Xia Cui',
    'Kate Macfarlane',
    'Seun Ajao',
    'Ashley Williams',
    'Sam Attwood',
    'Naomi Adel',
    'Filippos Ventirozos',
    'Charlie Roadhouse',
    'Paula Reyero Lobo',
    'Mkululi Sikosana',
  ];

  /** ROR identifier for Manchester Metropolitan University. */
  const MMU_ROR  = '04ycbcn43';

  /** Added to every request to opt into OpenAlex's polite pool. */
  const MAILTO   = 'nlp@mmu.ac.uk';

  /** Number of publications to display (sorted by most recent first). */
  const MAX_PUBS = 20;

  const BASE = 'https://api.openalex.org';

  /**
   * Work types that are not considered traditional academic publications.
   * These are hidden from the list.
   */
  const SKIP_TYPES = new Set(['dataset', 'paratext']);

  /* ── DOM handles ─────────────────────────────────────────────────── */
  const pubDynamic = document.getElementById('pubDynamic');
  const filtersEl  = document.getElementById('pubFilters');

  if (!pubDynamic) return; // guard: only run on pages with the publications widget

  /* ── Utilities ───────────────────────────────────────────────────── */

  async function apiFetch(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`OpenAlex HTTP ${res.status} — ${url}`);
    return res.json();
  }

  /** Minimal HTML escaping to prevent XSS from API data. */
  function esc(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /* ── Step 1: Resolve OpenAlex author ID for a given name ─────────── */

  /**
   * Returns the first matching OpenAlex author ID for `name`.
   * Searches with the MMU ROR scope first (disambiguates common names),
   * then falls back to a name-only search for early-career researchers
   * whose MMU affiliation may not yet be indexed.
   */
  async function resolveAuthorId(name) {
    const q = encodeURIComponent(name);

    // Pass 1 – MMU-scoped (high confidence for disambiguation)
    try {
      const d = await apiFetch(
        `${BASE}/authors?search=${q}` +
        `&filter=affiliations.institution.ror:${MMU_ROR}` +
        `&mailto=${MAILTO}`
      );
      if (d.results && d.results.length > 0) return d.results[0].id;
    } catch (_) { /* network hiccup – try fallback */ }

    // Pass 2 – name only (helps new joiners not yet indexed under MMU)
    try {
      const d = await apiFetch(`${BASE}/authors?search=${q}&mailto=${MAILTO}`);
      if (d.results && d.results.length > 0) return d.results[0].id;
    } catch (_) { /* unable to resolve this author */ }

    return null;
  }

  /* ── Step 2: Fetch works for a set of author IDs ─────────────────── */

  /**
   * Queries OpenAlex for the `MAX_PUBS` most-recent works authored by
   * any member of `authorIds`, sorted newest-first.
   */
  async function fetchWorks(authorIds) {
    // OpenAlex filter syntax: pipe-separated values = logical OR
    const idList = authorIds.map(id => id.split('/').pop()).join('|');

    const select = [
      'id', 'title', 'authorships', 'publication_year',
      'publication_date', 'primary_location', 'doi',
      'open_access', 'type', 'cited_by_count',
    ].join(',');

    const url =
      `${BASE}/works` +
      `?filter=authorships.author.id:${idList}` +
      `&sort=publication_date:desc` +
      `&per-page=${MAX_PUBS}` +
      `&select=${select}` +
      `&mailto=${MAILTO}`;

    const data = await apiFetch(url);
    return (data.results || []).filter(w => !SKIP_TYPES.has(w.type));
  }

  /* ── Step 3: Render year-filter buttons ──────────────────────────── */

  function renderFilters(works) {
    if (!filtersEl) return;

    const years = [
      ...new Set(works.map(w => w.publication_year).filter(Boolean)),
    ].sort((a, b) => b - a);

    filtersEl.innerHTML =
      '<button class="filter-btn active" data-year="all">All</button>' +
      years.map(y =>
        `<button class="filter-btn" data-year="${y}">${y}</button>`
      ).join('');

    filtersEl.addEventListener('click', e => {
      const btn = e.target.closest('.filter-btn');
      if (!btn) return;
      filtersEl.querySelectorAll('.filter-btn')
        .forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const year = btn.dataset.year;
      pubDynamic.querySelectorAll('.pub-item[data-year]').forEach(item => {
        item.hidden = year !== 'all' && item.dataset.year !== year;
      });
    });
  }

  /* ── Step 4: Render publication list ─────────────────────────────── */

  function renderWorks(works) {
    if (!works.length) {
      pubDynamic.innerHTML =
        '<p class="pub-empty">No publications could be loaded at this time.</p>';
      return;
    }

    const html = works.map(w => {
      const year  = w.publication_year || '—';
      const title = w.title || 'Untitled';

      // Authors – show up to 6 names, then "et al."
      const all    = w.authorships || [];
      const shown  = all.slice(0, 6)
        .map(a => a.author?.display_name || '')
        .filter(Boolean);
      const authors = shown.length < all.length
        ? shown.join(', ') + ' et al.'
        : shown.join(', ');

      // Venue / source name
      const venue = w.primary_location?.source?.display_name || '';

      // Action links
      const links = [];
      const doi = (w.doi || '').replace('https://doi.org/', '');
      if (doi) {
        links.push(
          `<a href="https://doi.org/${doi}" class="pub-link"` +
          ` target="_blank" rel="noopener noreferrer">DOI</a>`
        );
      }
      const oaUrl = w.open_access?.oa_url;
      if (oaUrl) {
        links.push(
          `<a href="${esc(oaUrl)}" class="pub-link"` +
          ` target="_blank" rel="noopener noreferrer">PDF</a>`
        );
      }
      if (w.id) {
        links.push(
          `<a href="${esc(w.id)}" class="pub-link"` +
          ` target="_blank" rel="noopener noreferrer">OpenAlex</a>`
        );
      }

      return `
        <article class="pub-item" data-year="${year}">
          <span class="pub-year">${year}</span>
          <div class="pub-content">
            <h4>${esc(title)}</h4>
            ${authors ? `<p class="pub-authors">${esc(authors)}</p>` : ''}
            ${venue   ? `<p class="pub-venue">${esc(venue)}</p>`   : ''}
            ${links.length ? `<div class="pub-links">${links.join('')}</div>` : ''}
          </div>
        </article>`;
    }).join('');

    pubDynamic.innerHTML = `<div class="pub-list">${html}</div>`;
  }

  /* ── Main ────────────────────────────────────────────────────────── */

  async function load() {
    // Show loading indicator
    pubDynamic.innerHTML = `
      <div class="pub-loading" aria-live="polite">
        <div class="pub-spinner" role="status" aria-label="Loading"></div>
        <p>Loading publications from
          <a href="https://openalex.org" target="_blank" rel="noopener noreferrer">OpenAlex</a>…
        </p>
      </div>`;

    try {
      // Resolve all author IDs concurrently
      const ids = (await Promise.all(AUTHORS.map(resolveAuthorId))).filter(Boolean);

      if (ids.length === 0) throw new Error('Could not resolve any author IDs');

      const works = await fetchWorks(ids);

      if (works.length === 0) throw new Error('No publications returned');

      renderFilters(works);
      renderWorks(works);

    } catch (err) {
      console.error('[MMU NLP] Publications load failed:', err);
      pubDynamic.innerHTML = `
        <div class="pub-error">
          <p>
            ⚠️ Publications could not be loaded automatically right now.
            <a href="https://openalex.org/works?filter=institutions.ror:${MMU_ROR}&sort=publication_date:desc"
               target="_blank" rel="noopener noreferrer">
              Browse on OpenAlex ↗
            </a>
          </p>
        </div>`;
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', load);
  } else {
    load();
  }

})();
