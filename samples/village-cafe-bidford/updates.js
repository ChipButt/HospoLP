/* Village Café — five most recent authorised social posts displayed directly on-page.
   No link tiles. Historical archive photos are labelled separately from original post media. */
(() => {
  'use strict';
  const MAX_POSTS = 5;
  const POLL_MS = 120000; // Check for a newly published GitHub Pages feed every two minutes.
  const grid = document.getElementById('cafe-posts-grid');
  const filters = document.getElementById('social-post-filters');
  const empty = document.getElementById('cafe-feed-empty');
  const heading = document.getElementById('cafe-posts-heading');
  if (!grid || !filters || !empty || !heading) return;

  // Only assets hosted in the café's own repository can be displayed.
  const allowedArchivePhotos = new Set([
    'assets/village-cafe/community-guests.avif',
    'assets/village-cafe/garden.avif',
    'assets/village-cafe/home-story-exterior.avif',
    'assets/village-cafe/original-shopfront.avif'
  ]);
  function localPhoto(post) {
    if (typeof post.image !== 'string') return null;
    if (post.archive === true && post.image_context === 'archive_illustration' &&
        allowedArchivePhotos.has(post.image)) return post.image;
    return /^assets\/village-cafe\/social\/[A-Za-z0-9._-]+\.webp$/.test(post.image)
      ? post.image : null;
  }
  function timestamp(value) {
    if (typeof value !== 'string') return 0;
    const time = Date.parse(value);
    return Number.isFinite(time) ? time : 0;
  }
  function displayDate(value) {
    const time = timestamp(value);
    return time ? new Date(time).toLocaleDateString('en-GB',
      {day:'numeric',month:'long',year:'numeric'}) : '';
  }
  function validPost(post) {
    return post && typeof post === 'object' &&
      ['facebook','instagram'].includes(post.source) &&
      ((typeof post.text === 'string' && post.text.trim()) || localPhoto(post));
  }
  function buildPost(post) {
    const article = document.createElement('article');
    article.className = 'village-feed-post';

    const byline = document.createElement('div');
    byline.className = 'village-feed-byline';
    const emblem = document.createElement('span');
    emblem.className = 'village-feed-emblem';
    emblem.textContent = 'V';
    emblem.setAttribute('aria-hidden', 'true');
    byline.appendChild(emblem);

    const identity = document.createElement('div');
    const author = document.createElement('strong');
    author.className = 'village-feed-author';
    author.textContent = 'The Village Cafe';
    identity.appendChild(author);
    const metadata = document.createElement('div');
    metadata.className = 'village-feed-meta';
    metadata.textContent = [
      post.source === 'facebook' ? 'Facebook' : 'Instagram',
      post.archive === true ? 'From the archive' : displayDate(post.published_at)
    ].filter(Boolean).join(' · ');
    identity.appendChild(metadata);
    byline.appendChild(identity);
    article.appendChild(byline);

    if (typeof post.text === 'string' && post.text.trim()) {
      const caption = document.createElement('p');
      caption.className = 'village-feed-caption';
      caption.textContent = post.text.trim();
      article.appendChild(caption);
    }

    const photo = localPhoto(post);
    if (photo) {
      const figure = document.createElement('figure');
      figure.className = 'village-feed-image';
      const img = document.createElement('img');
      img.src = photo;
      img.loading = 'lazy';
      img.alt = post.image_context === 'archive_illustration'
        ? 'Photograph from The Village Cafe archive'
        : 'Photograph published by The Village Cafe';
      img.addEventListener('error', () => figure.remove(), {once:true});
      figure.appendChild(img);
      if (post.image_context === 'archive_illustration') {
        const note = document.createElement('figcaption');
        note.textContent = 'From the café photo archive';
        figure.appendChild(note);
      }
      article.appendChild(figure);
    }
    return article;
  }
  let rendered = [];
  let filter = 'all';
  let lastPayload = '';
  let loading = false;
  function applyFilter() {
    let count = 0;
    for (const item of rendered) {
      const show = filter === 'all' || item.source === filter;
      item.element.hidden = !show;
      if (show) count++;
    }
    if (!count && filter !== 'all') {
      filter = 'all';
      return applyFilter();
    }
    for (const button of filters.querySelectorAll('[data-filter]')) {
      const active = button.dataset.filter === filter;
      button.classList.toggle('active',active);
      button.setAttribute('aria-pressed',String(active));
    }
  }
  for (const button of filters.querySelectorAll('[data-filter]')) {
    button.addEventListener('click', () => {
      filter = button.dataset.filter || 'all';
      applyFilter();
    });
  }
  async function refreshFeed() {
    if (loading || document.visibilityState === 'hidden') return;
    loading = true;
    try {
      const response = await fetch('data/social-posts.json?v=' + Date.now(),
        {cache:'no-store'});
      if (!response.ok) throw new Error('Feed unavailable');
      const payload = await response.json();
      if (!payload || !Array.isArray(payload.posts)) throw new Error('Invalid feed');
      const candidates = payload.posts.filter(validPost);
      // Never present undated historical entries as one of the five latest live posts.
      const live = candidates.filter(p => p.archive !== true && timestamp(p.published_at));
      const posts = live.length
        ? live.sort((a,b) => timestamp(b.published_at)-timestamp(a.published_at)).slice(0,MAX_POSTS)
        : candidates.filter(p => p.archive === true).slice(0,MAX_POSTS);
      const signature = JSON.stringify(posts);
      if (signature === lastPayload) return;
      lastPayload = signature;
      const fragment = document.createDocumentFragment();
      const next = [];
      for (const post of posts) {
        const element = buildPost(post);
        fragment.appendChild(element);
        next.push({source:post.source,element});
      }
      grid.replaceChildren(fragment);
      rendered = next;
      empty.hidden = rendered.length > 0;
      heading.textContent = live.length ? 'Latest from the café'
        : rendered.length ? 'From our archive' : 'Café updates';
      filters.hidden = new Set(rendered.map(p => p.source)).size < 2;
      applyFilter();
    } catch (_) {
      // Preserve the last successfully displayed posts during temporary failures.
      if (!rendered.length) empty.hidden = false;
    } finally {
      loading = false;
    }
  }
  refreshFeed();
  window.setInterval(refreshFeed,POLL_MS);
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') refreshFeed();
  });
})();
