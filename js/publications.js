/* ── MMU NLP Group – Publications auto-loader ──────────────────────── */
(function () {
  'use strict';

  const MMU_ROR = '04ycbcn43';
  const MAILTO = 'nlp@mmu.ac.uk';
  const MAX_PUBS = 20;
  const BASE = 'https://api.openalex.org';
  const SKIP_TYPES = new Set(['dataset', 'paratext']);

  const pubDynamic = document.getElementById('pubDynamic');
  const filtersEl = document.getElementById('pubFilters');
  if (!pubDynamic) return;

  async function apiFetch(url) {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`OpenAlex HTTP ${res.status} — ${url}`);
    return res.json();
  }

  function esc(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  const GROUP_AUTHORS = [
    { name: 'Matthew Shardlow' },
    { name: 'Xia Cui', orcid: '0000-0002-1726-3814' },
    { name: 'Kate Macfarlane' },
    { name: 'Seun Ajao' },
    { name: 'Ashley Williams', orcid: '0000-0002-6888-0521' },
    { name: 'Sam Attwood' },
    { name: 'Naomi Adel' },
    { name: 'Filippos Ventirozos' },
    { name: 'Charlie Roadhouse' },
    { name: 'Paula Reyero Lobo' },
    { name: 'Mkululi Sikosana' },
  ];

  async function resolveAuthorId(author) {
    if (author.openAlexAuthorId) return author.openAlexAuthorId;

    if (author.orcid) {
      try {
        const d = await apiFetch(
          `${BASE}/authors?filter=orcid:${encodeURIComponent(author.orcid)}&mailto=${MAILTO}`
        );
        if (d.results?.length) return d.results[0].id;
      } catch (_) {}
    }

    const q = encodeURIComponent(author.name);

    try {
      const d = await apiFetch(
        `${BASE}/authors?search=${q}&filter=affiliations.institution.ror:${MMU_ROR}&mailto=${MAILTO}`
      );
      if (d.results?.length) return d.results[0].id;
    } catch (_) {}

    try {
      const d = await apiFetch(`${BASE}/authors?search=${q}&mailto=${MAILTO}`);
      if (d.results?.length) return d.results[0].id;
    } catch (_) {}

    return null;
  }

  async function fetchWorks(authorIds) {
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

  function renderFilters(works) {
    if (!filtersEl) return;

    const years = [...new Set(works.map(w => w.publication_year).filter(Boolean))]
      .sort((a, b) => b - a);

    filtersEl.innerHTML =
      '<button class="filter-btn active" data-year="all">All</button>' +
      years.map(y => `<button class="filter-btn" data-year="${y}">${y}</button>`).join('');

    filtersEl.addEventListener('click', e => {
      const btn = e.target.closest('.filter-btn');
      if (!btn) return;
      filtersEl.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      const year = btn.dataset.year;
      pubDynamic.querySelectorAll('.pub-item[data-year]').forEach(item => {
        item.hidden = year !== 'all' && item.dataset.year !== year;
      });
    });
  }

  function renderWorks(works) {
    if (!works.length) {
      pubDynamic.innerHTML = '<p class="pub-empty">No publications could be loaded at this time.</p>';
      return;
    }

    const html = works.map(w => {
      const year = w.publication_year || '—';
      const title = w.title || 'Untitled';

      const all = w.authorships || [];
      const shown = all.slice(0, 6).map(a => a.author?.display_name || '').filter(Boolean);
      const authors = shown.length < all.length ? `${shown.join(', ')} et al.` : shown.join(', ');
      const venue = w.primary_location?.source?.display_name || '';

      const links = [];
      const doi = (w.doi || '').replace('https://doi.org/', '');
      if (doi) links.push(`<a href="https://doi.org/${doi}" class="pub-link" target="_blank" rel="noopener noreferrer">DOI</a>`);
      const oaUrl = w.open_access?.oa_url;
      if (oaUrl) links.push(`<a href="${esc(oaUrl)}" class="pub-link" target="_blank" rel="noopener noreferrer">PDF</a>`);
      if (w.id) links.push(`<a href="${esc(w.id)}" class="pub-link" target="_blank" rel="noopener noreferrer">OpenAlex</a>`);

      return `
        <article class="pub-item" data-year="${year}">
          <span class="pub-year">${year}</span>
          <div class="pub-content">
            <h4>${esc(title)}</h4>
            ${authors ? `<p class="pub-authors">${esc(authors)}</p>` : ''}
            ${venue ? `<p class="pub-venue">${esc(venue)}</p>` : ''}
            ${links.length ? `<div class="pub-links">${links.join('')}</div>` : ''}
          </div>
        </article>
      `;
    }).join('');

    pubDynamic.innerHTML = `<div class="pub-list">${html}</div>`;
  }

  async function load() {
    pubDynamic.innerHTML = `
      <div class="pub-loading" aria-live="polite">
        <div class="pub-spinner" role="status" aria-label="Loading"></div>
        <p>Loading publications from
          <a href="https://openalex.org" target="_blank" rel="noopener noreferrer">OpenAlex</a>…
        </p>
      </div>
    `;

    try {
      const ids = (await Promise.all(GROUP_AUTHORS.map(resolveAuthorId))).filter(Boolean);
      const uniqueIds = [...new Set(ids)];
      if (!uniqueIds.length) throw new Error('Could not resolve any author IDs');

      const works = await fetchWorks(uniqueIds);
      if (!works.length) throw new Error('No publications returned');

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
        </div>
      `;
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', load);
  } else {
    load();
  }
})();
