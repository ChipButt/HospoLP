/* Village Cafe — render social updates directly on the page. No post links or click-through cards. */
(() => {
  'use strict';
  const grid = document.getElementById('cafe-posts-grid');
  const filters = document.getElementById('social-post-filters');
  const empty = document.getElementById('cafe-feed-empty');
  const heading = document.getElementById('cafe-posts-heading');
  if (!grid || !filters || !empty || !heading) return;

  function localPhoto(post) {
    if (typeof post.image !== 'string') return null;
    return /^assets\/village-cafe\/social\/[A-Za-z0-9._-]+\.webp$/.test(post.image)
      ? post.image : null;
  }
  function displayDate(value) {
    if (typeof value !== 'string' || !value.trim()) return '';
    const date = new Date(value);
    return Number.isFinite(date.getTime())
      ? date.toLocaleDateString('en-GB', {day: 'numeric', month: 'long', year: 'numeric'})
      : '';
  }

  function buildPost(post) {
    if (!post || !['facebook','instagram'].includes(post.source)) return null;
    const caption = typeof post.text === 'string' ? post.text.trim() : '';
    const imagePath = localPhoto(post);
    if (!caption && !imagePath) return null;

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
    const label = post.source === 'facebook' ? 'Facebook' : 'Instagram';
    const date = displayDate(post.published_at);
    metadata.textContent = [label, post.archive === true ? 'From the archive' : date].filter(Boolean).join(' · ');
    identity.appendChild(metadata);
    byline.appendChild(identity);
    article.appendChild(byline);

    if (caption) {
      const text = document.createElement('p');
      text.className = 'village-feed-caption';
      text.textContent = caption;
      article.appendChild(text);
    }
    if (imagePath) {
      const frame = document.createElement('figure');
      frame.className = 'village-feed-image';
      const img = document.createElement('img');
      img.src = imagePath;
      img.alt = 'Photo shared by The Village Cafe';
      img.loading = 'lazy';
      img.addEventListener('error', () => frame.remove(), {once:true});
      frame.appendChild(img);
      article.appendChild(frame);
    }
    return article;
  }

  const rendered = [];
  function showFilter(filter) {
    let count = 0;
    for (const item of rendered) {
      const show = filter === 'all' || item.source === filter;
      item.element.hidden = !show;
      if (show) count++;
    }
    for (const btn of filters.querySelectorAll('[data-filter]')) {
      const active = btn.dataset.filter === filter;
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-pressed', String(active));
    }
    if (!count && filter !== 'all') showFilter('all');
  }

  for (const btn of filters.querySelectorAll('[data-filter]')) {
    btn.addEventListener('click', () => showFilter(btn.dataset.filter));
  }

  async function loadFeed() {
    try {
      const response = await fetch('data/social-posts.json?v=' + Math.floor(Date.now()/3600000), {cache: 'no-store'});
      if (!response.ok) throw new Error('Feed unavailable');
      const data = await response.json();
      if (!data || !Array.isArray(data.posts)) throw new Error('Feed data invalid');
      const posts = data.posts.filter(p => p && typeof p === 'object')
        .sort((a,b) => Date.parse(b.published_at || '') - Date.parse(a.published_at || ''))
        .slice(0,12);

      for (const post of posts) {
        const element = buildPost(post);
        if (!element) continue;
        grid.appendChild(element);
        rendered.push({source:post.source, element});
      }
      if (rendered.length === 0) {
        empty.hidden = false;
        return;
      }
      const onlyArchive = posts.every(p => p.archive === true);
      heading.textContent = onlyArchive ? 'From our archive' : 'Latest from the café';
      filters.hidden = new Set(rendered.map(p => p.source)).size < 2;
      showFilter('all');
    } catch (_) {
      empty.hidden = false;
    }
  }
  loadFeed();
})();