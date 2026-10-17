/* Village Cafe social cards. Real posts only; no fabricated updates. */
(() => {
  'use strict';
  const feed = document.getElementById('cafe-post-feed');
  const showcase = document.getElementById('cafe-photo-highlights');
  const grid = document.getElementById('cafe-posts-grid');
  const filters = document.getElementById('social-post-filters');
  if (!feed || !showcase || !grid || !filters) return;

  const allowedHosts = {
    facebook: /(^|\.)facebook\.com$/i,
    instagram: /(^|\.)instagram\.com$/i
  };
  function linkFor(post) {
    if (!['facebook', 'instagram'].includes(post.source)) return null;
    try {
      const url = new URL(post.permalink);
      if (url.protocol !== 'https:' || !allowedHosts[post.source].test(url.hostname)) return null;
      return url.href;
    } catch (_) { return null; }
  }
  function photoFor(post) {
    return typeof post.image === 'string' &&
      /^assets\/village-cafe\/social\/[a-zA-Z0-9._-]+\.webp$/.test(post.image)
      ? post.image : null;
  }
  function buildCard(post) {
    const href = linkFor(post);
    if (!href) return null;
    const card = document.createElement('article');
    card.className = 'social-post-card';
    if (photoFor(post)) {
      const pictureLink = document.createElement('a');
      pictureLink.href = href;
      pictureLink.target = '_blank';
      pictureLink.rel = 'noopener noreferrer';
      pictureLink.className = 'social-post-image';
      const img = document.createElement('img');
      img.loading = 'lazy';
      img.src = photoFor(post);
      img.alt = post.source === 'facebook' ? 'Photo shared on Facebook' : 'Photo shared on Instagram';
      img.addEventListener('error', () => pictureLink.remove(), {once:true});
      pictureLink.appendChild(img);
      card.appendChild(pictureLink);
    }
    const body = document.createElement('div');
    body.className = 'social-post-body';
    const meta = document.createElement('div');
    meta.className = 'social-post-meta';
    let displayDate = '';
    if (typeof post.published_at === 'string' && post.published_at) {
      const date = new Date(post.published_at);
      if (Number.isFinite(date.getTime())) {
        displayDate = date.toLocaleDateString('en-GB', {day:'numeric', month:'short', year:'numeric'});
      }
    }
    meta.textContent = (post.source === 'facebook' ? 'Facebook' : 'Instagram') +
      (post.archive === true ? ' · From the archive' : displayDate ? ' · ' + displayDate : '');
    body.appendChild(meta);
    const caption = document.createElement('p');
    caption.className = 'social-post-text';
    caption.textContent = typeof post.text === 'string' && post.text.trim()
      ? post.text.trim().slice(0, 520) : 'A little something from The Village Cafe.';
    body.appendChild(caption);
    const link = document.createElement('a');
    link.href = href;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.className = 'social-post-link';
    link.textContent = 'See the post ↗';
    body.appendChild(link);
    card.appendChild(body);
    return card;
  }
  const postNodes = [];
  function showFilter(filter) {
    let count = 0;
    for (const entry of postNodes) {
      const visible = filter === 'all' || entry.source === filter;
      entry.node.hidden = !visible;
      if (visible) count++;
    }
    for (const btn of filters.querySelectorAll('button[data-filter]')) {
      const active = btn.dataset.filter === filter;
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-pressed', String(active));
    }
    if (!count) showFilter('all');
  }
  for (const btn of filters.querySelectorAll('button[data-filter]')) {
    btn.addEventListener('click', () => showFilter(btn.dataset.filter));
  }
  async function load() {
    try {
      const response = await fetch('data/social-posts.json?cache=' + Math.floor(Date.now()/3600000), {cache:'no-store'});
      if (!response.ok) return;
      const payload = await response.json();
      if (!payload || !Array.isArray(payload.posts)) return;
      const valid = payload.posts.filter(p => p && typeof p === 'object' && linkFor(p))
        .sort((a,b) => Date.parse(b.published_at || '') - Date.parse(a.published_at || ''))
        .slice(0,12);
      for (const post of valid) {
        const node = buildCard(post);
        if (!node) continue;
        grid.appendChild(node);
        postNodes.push({source:post.source, node});
      }
      if (!postNodes.length) return;
      feed.hidden = false;
      const archiveOnly = valid.every(p => p.archive === true);
      // Archived examples stay separate from the automatic dated feed.
      showcase.hidden = !archiveOnly;
      if (archiveOnly) {
        const heading = document.getElementById('cafe-posts-heading');
        if (heading) heading.textContent = 'From our Facebook archive';
      }
      const sources = new Set(postNodes.map(p => p.source));
      filters.hidden = sources.size < 2;
      showFilter('all');
    } catch (_) {
      // Keep the authored café photo gallery when a feed isn't connected.
    }
  }
  load();
})();
