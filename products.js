const names = {
  plugins: 'Plugins',
  setups: 'Setups',
  configs: 'Configs',
  skript: 'Skript',
  mods: 'Mods',
  resourcepacks: 'Resource Packs',
  premium_plugins: 'Premium Plugins',
  premium_setups: 'Premium Setups',
  premium_configs: 'Premium Configs',
  premium_resourcepacks: 'Premium Resource Packs',
  premium_skript: 'Premium Skript'
};

// State is derived from the URL so filters survive refresh/back-button.
function readState() {
  const params = new URLSearchParams(location.search);
  return {
    category: params.get('category') || 'plugins',
    search: params.get('search') || '',
    sort: params.get('sort') || 'newest',
    page: Math.max(1, Number(params.get('page')) || 1)
  };
}

function writeState(state, { replace = false } = {}) {
  const params = new URLSearchParams();
  params.set('category', state.category);
  if (state.search) params.set('search', state.search);
  if (state.sort && state.sort !== 'newest') params.set('sort', state.sort);
  if (state.page && state.page !== 1) params.set('page', String(state.page));
  const url = `${location.pathname}?${params.toString()}`;
  try {
    if (replace) history.replaceState(null, '', url);
    else history.pushState(null, '', url);
  } catch (e) {
    console.warn('History API not supported (e.g. running from file://):', e.message);
  }
}

let state = readState();
let debounceTimer = null;

const pageTitle = document.getElementById('pageTitle');
const pageSub = document.getElementById('pageSub');
const productsGrid = document.getElementById('productsGrid');
const searchInput = document.getElementById('searchInput');
const sortSelect = document.getElementById('sortSelect');
const resultCount = document.getElementById('resultCount');
const paginationTop = document.getElementById('paginationTop');
const paginationBottom = document.getElementById('paginationBottom');

function escapeHtml(value) {
  return String(value || '').replace(/[&<>'"]/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    "'": '&#39;',
    '"': '&quot;'
  }[character]));
}

function parseEmojis(text) {
  if (!text) return '';
  return text
    .replace(/(?:&lt;|<):([a-zA-Z0-9_]+):[0-9]+(?:&gt;|>)/g, '<img class="custom-emoji" src="assets/emojis/$1.png" alt=":$1:" onerror="this.replaceWith(this.alt)">')
    .replace(/:([a-zA-Z0-9_]+):/g, '<img class="custom-emoji" src="assets/emojis/$1.png" alt=":$1:" onerror="this.replaceWith(this.alt)">');
}

function formatCount(value) {
  const number = Number(value || 0);
  if (number >= 1000000) return `${(number / 1000000).toFixed(number % 1000000 === 0 ? 0 : 1)}M`;
  if (number >= 1000) return `${(number / 1000).toFixed(number % 1000 === 0 ? 0 : 1)}K`;
  return String(number);
}

function timeAgo(dateString) {
  if (!dateString) return '';
  const then = new Date(dateString).getTime();
  if (Number.isNaN(then)) return '';
  const diffMs = Date.now() - then;
  const day = 86400000;
  const days = Math.floor(diffMs / day);
  if (days <= 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  if (days < 14) return 'Last week';
  if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
  if (days < 60) return 'Last month';
  if (days < 365) return `${Math.floor(days / 30)} months ago`;
  return `${Math.floor(days / 365)} years ago`;
}

function loaderLabel(value) {
  const map = { paper: 'Paper', spigot: 'Spigot', fabric: 'Fabric', forge: 'Forge' };
  return map[value] || value;
}

function platformLabel(value) {
  const map = { bungeecord: 'BungeeCord', geyser: 'Geyser Extension', velocity: 'Velocity', waterfall: 'Waterfall' };
  return map[value] || value;
}

function applyActiveStates() {
  document.querySelectorAll('[data-cat]').forEach((link) => {
    link.classList.toggle('active', link.dataset.cat === state.category);
  });
  if (searchInput) searchInput.value = state.search;
  if (sortSelect) sortSelect.value = state.sort;
}

function errorCard(title, message, extra = '') {
  productsGrid.innerHTML = `
    <div class="market-card market-card-empty">
      <h3>${escapeHtml(title)}</h3>
      <p>${escapeHtml(message)}</p>
      ${extra ? `<small>${escapeHtml(extra)}</small>` : ''}
    </div>
  `;
}

function renderPagination(container, page, totalPages) {
  if (!container) return;
  if (totalPages <= 1) { container.innerHTML = ''; return; }

  let pages;
  if (totalPages <= 7) {
    pages = Array.from({ length: totalPages }, (_, i) => i + 1);
  } else {
    pages = [1];
    if (page > 3) pages.push('...');
    for (let n = Math.max(2, page - 1); n <= Math.min(totalPages - 1, page + 1); n++) pages.push(n);
    if (page < totalPages - 2) pages.push('...');
    pages.push(totalPages);
  }

  const unique = [...new Set(pages)];

  container.innerHTML = `
    <button class="page-btn page-arrow" data-page="${page - 1}" ${page <= 1 ? 'disabled' : ''}>‹</button>
    ${unique.map((p) => p === '...'
      ? `<span class="page-ellipsis">…</span>`
      : `<button class="page-btn ${p === page ? 'active' : ''}" data-page="${p}">${p}</button>`
    ).join('')}
    <button class="page-btn page-arrow" data-page="${page + 1}" ${page >= totalPages ? 'disabled' : ''}>›</button>
  `;

  container.querySelectorAll('.page-btn[data-page]').forEach((button) => {
    button.addEventListener('click', () => {
      const next = Number(button.dataset.page);
      if (!next || next < 1 || next > totalPages || next === state.page) return;
      state.page = next;
      writeState(state);
      loadProducts();
      window.scrollTo({ top: document.querySelector('.products-main')?.offsetTop - 100 || 0, behavior: 'smooth' });
    });
  });
}

function buildProductsUrl() {
  const params = new URLSearchParams();
  params.set('category', state.category);
  params.set('page', String(state.page));
  params.set('perPage', '20');
  if (state.search) params.set('search', state.search);
  if (state.sort) params.set('sort', state.sort);
  return apiUrl(`/api/products?${params.toString()}`);
}

function renderProductRow(product) {
  const loaders = (product.loaders || []).map(loaderLabel);
  const platforms = (product.platforms || []).map(platformLabel);
  const tags = [...loaders, ...platforms].slice(0, 4);
  const extraTagCount = (loaders.length + platforms.length) - tags.length;

  const premiumTag = product.is_premium
    ? `<span class="tag-chip tag-chip-premium" style="background: rgba(251, 191, 36, 0.16); color: #fbbf24; border-color: rgba(251, 191, 36, 0.38); font-weight: 900;">Premium</span>`
    : '';

  const priceBadge = product.is_premium
    ? `<span class="premium-price-badge" style="display: inline-block; padding: 4px 10px; border-radius: 8px; background: rgba(251, 191, 36, 0.16); color: #fbbf24; font-weight: 900; font-size: 0.95rem; border: 1px solid rgba(251, 191, 36, 0.3); margin-bottom: 6px;">$${Number(product.price || 0).toFixed(2)}</span>`
    : '';

  const iconUrl = product.icon_file ? apiUrl('/files/' + product.icon_file) : (product.icon_url || 'assets/pack.png');

  return `
    <a class="market-card market-row ${product.is_premium ? 'premium-market-row' : ''}" href="project.html?id=${product.id}">
      <img class="project-icon" src="${iconUrl}" onerror="this.src='assets/pack.png'" alt="">
      <div class="market-row-body">
        <div class="market-row-head">
          <h3>${parseEmojis(escapeHtml(product.title))}</h3>
          <span class="market-row-author">by ${escapeHtml(product.author || product.uploader || 'Azor Studios')}</span>
        </div>
        <p class="market-row-desc">${parseEmojis(escapeHtml(product.short_description))}</p>
        <div class="market-row-tags">
          ${premiumTag}
          ${tags.map((tag) => `<span class="tag-chip">${escapeHtml(tag)}</span>`).join('')}
          ${extraTagCount > 0 ? `<span class="tag-chip tag-chip-more">+${extraTagCount}</span>` : ''}
        </div>
      </div>
      <div class="market-row-stats">
        ${priceBadge}
        <span><b>${formatCount(product.downloads)}</b> downloads</span>
        <span class="market-row-updated">${escapeHtml(timeAgo(product.updated_at || product.created_at))}</span>
      </div>
    </a>
  `;
}

async function loadProducts() {
  if (!API_BASE) {
    errorCard('Backend URL missing', 'Open config.js and set window.OBSIDIAN_API_URL to your Railway backend URL.', `Current API URL: ${API_BASE || 'empty'}`);
    return;
  }

  productsGrid.innerHTML = `<div class="market-card market-card-empty"><h3>Loading...</h3></div>`;

  try {
    const url = buildProductsUrl();
    const response = await fetch(url, { credentials: 'include' });
    const contentType = response.headers.get('content-type') || '';
    if (!contentType.includes('application/json')) throw new Error(`Backend returned non-JSON response. URL: ${url}`);

    const data = await response.json();
    if (!response.ok) throw new Error(data.error || `Request failed with status ${response.status}`);

    const products = Array.isArray(data.products) ? data.products : [];
    const total = Number(data.total || products.length);
    const totalPages = Number(data.totalPages || 1);

    resultCount.textContent = total ? `${formatCount(total)} result${total === 1 ? '' : 's'}` : '';
    renderPagination(paginationTop, state.page, totalPages);
    renderPagination(paginationBottom, state.page, totalPages);

    if (!products.length) {
      productsGrid.innerHTML = `<div class="market-card market-card-empty"><h3>No ${escapeHtml(names[state.category] || 'products')} found</h3><p>Try adjusting your search or category.</p></div>`;
      return;
    }

    productsGrid.innerHTML = products.map(renderProductRow).join('');
  } catch (error) {
    console.error('Product load failed:', error);
    errorCard('Could not load products', error.message, 'Check /api/products on your Railway backend.');
    resultCount.textContent = '';
    renderPagination(paginationTop, 1, 1);
    renderPagination(paginationBottom, 1, 1);
  }
}

function refreshHeader() {
  pageTitle.textContent = names[state.category] || 'Products';
  pageSub.textContent = `Browse ${names[state.category] || 'products'} uploaded by Azor Studios.`;
  document.title = `${names[state.category] || 'Products'} — Azor Studios`;
}

document.addEventListener('click', (event) => {
  const navCat = event.target.closest('a[data-cat]');
  if (navCat) {
    event.preventDefault();
    state.category = navCat.dataset.cat;
    state.page = 1;
    writeState(state);
    refreshHeader();
    applyActiveStates();
    loadProducts();
    return;
  }
});

searchInput?.addEventListener('input', () => {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    state.search = searchInput.value.trim();
    state.page = 1;
    writeState(state);
    loadProducts();
  }, 350);
});

sortSelect?.addEventListener('change', () => {
  state.sort = sortSelect.value;
  state.page = 1;
  writeState(state);
  loadProducts();
});

window.addEventListener('popstate', () => {
  state = readState();
  refreshHeader();
  applyActiveStates();
  loadProducts();
});

writeState(state, { replace: true });
refreshHeader();
applyActiveStates();
loadProducts();
