const API_BASE = (window.OBSIDIAN_API_URL || '').replace(/\/$/, '');
const apiUrl = (path) => `${API_BASE}${path}`;

let cachedProducts = [];
let currentProductSearch = '';

/* ─────────── Helpers ─────────── */

async function api(path, options = {}) {
  let res;
  try {
    res = await fetch(apiUrl(path), { credentials: 'include', ...options });
  } catch (error) {
    throw new Error('Backend is not reachable. Check config.js and Railway backend URL.');
  }
  const contentType = res.headers.get('content-type') || '';
  const data = contentType.includes('application/json') ? await res.json().catch(() => ({})) : {};
  if (!res.ok) {
    if (!contentType.includes('application/json')) throw new Error('API route not found. Deploy the Node backend, not a static-only site.');
    throw new Error(data.error || `Request failed (${res.status})`);
  }
  return data;
}

function escapeHtml(s) {
  return String(s || '').replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));
}

function parseEmojis(text) {
  if (!text) return '';
  return text
    .replace(/(?:&lt;|<):([a-zA-Z0-9_]+):[0-9]+(?:&gt;|>)/g, '<img class="custom-emoji" src="assets/emojis/$1.png" alt=":$1:" onerror="this.replaceWith(this.alt)">')
    .replace(/:([a-zA-Z0-9_]+):/g, '<img class="custom-emoji" src="assets/emojis/$1.png" alt=":$1:" onerror="this.replaceWith(this.alt)">');
}

function formatSize(bytes) {
  let size = Number(bytes || 0);
  const units = ['B', 'KB', 'MB', 'GB'];
  let unit = 0;
  while (size > 1024 && unit < units.length - 1) { size /= 1024; unit++; }
  return `${size.toFixed(unit ? 1 : 0)} ${units[unit]}`;
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
  if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
  if (days < 365) return `${Math.floor(days / 30)} months ago`;
  return `${Math.floor(days / 365)} years ago`;
}

function table(headers, rows) {
  if (!rows.length) return '<p class="empty-table">Nothing here yet.</p>';
  return `<table><thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.map(row => `<tr>${row.map(cell => `<td>${cell ?? ''}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
}

const categoryNames = {
  plugins: 'Plugin', setups: 'Setup', configs: 'Config',
  skript: 'Skript', mods: 'Mod', resourcepacks: 'Resource Pack'
};

const categoryIcons = {
  plugins: '▣', setups: '⌘', configs: '{ }',
  skript: '✦', mods: '⬢', resourcepacks: '◇'
};

/* ─────────── Modal Management ─────────── */

function openModal(id) {
  document.getElementById(id)?.classList.add('open');
}

function closeModal(id) {
  document.getElementById(id)?.classList.remove('open');
}

// Close modals on backdrop click or × button
document.querySelectorAll('.modal').forEach(modal => {
  modal.addEventListener('click', e => {
    if (e.target === modal) closeModal(modal.id);
  });
});

document.querySelectorAll('.modal-close').forEach(btn => {
  btn.addEventListener('click', () => {
    btn.closest('.modal')?.classList.remove('open');
  });
});

/* ─────────── View Switching ─────────── */

document.querySelectorAll('.admin-menu a[data-view]').forEach(link => {
  link.addEventListener('click', () => {
    document.querySelectorAll('.admin-menu a').forEach(a => a.classList.remove('active'));
    link.classList.add('active');

    document.querySelectorAll('.admin-view').forEach(v => v.classList.remove('active'));
    const target = document.getElementById(`view-${link.dataset.view}`);
    target?.classList.add('active');

    if (link.dataset.view === 'analytics') loadAnalytics();
    if (link.dataset.view === 'emojis') loadEmojisView();
    if (link.dataset.view === 'themes') loadThemesView();
  });
});

/* ─────────── Themes View ─────────── */

function loadThemesView() {
  const current = localStorage.getItem('azor_theme') || 'default';
  document.querySelectorAll('.theme-card').forEach(c => c.classList.remove('active'));
  if (current === 'summer') {
    document.getElementById('themeCardSummer')?.classList.add('active');
  } else {
    document.getElementById('themeCardDefault')?.classList.add('active');
  }
}

async function setWebsiteTheme(theme) {
  try {
    await api('/api/admin/theme', {
      method: 'POST',
      body: JSON.stringify({ theme })
    });
    localStorage.setItem('azor_theme', theme);
    if (theme === 'summer') {
      document.documentElement.classList.add('theme-summer');
    } else {
      document.documentElement.classList.remove('theme-summer');
    }
    loadThemesView();
    const toast = document.getElementById('themeChangeToast');
    if (toast) {
      toast.textContent = `Global theme switched to ${theme.toUpperCase()} for all users!`;
      toast.classList.add('show');
      setTimeout(() => toast.classList.remove('show'), 2500);
    }
  } catch (error) {
    alert(`Failed to update global theme: ${error.message}`);
  }
}

/* ─────────── Emojis View ─────────── */

const customEmojiList = [
  // Tools & Weapons
  'sword', 'pickaxe', 'axe', 'shovel', 'hoe', 'fishing_rod', 'briefcase',
  // Blocks & Stations
  'anvil', 'chest', 'furnace', 'brewing_stand', 'enchanting_table', 'blocks',
  // Items & Economy
  'coins', 'emerald', 'map', 'banner', 'armor', 'cow',
  // Scrolls & Presents
  'scroll_green', 'scroll_blue', 'scroll_purple', 'scroll_red', 'gift', 'gift_glow', 'gift_open',
  // XP & Bottles
  'coin_bottle_small', 'coin_bottle_big', 'xp', 'xp_bottle_small',
  // Arrows
  'arrow_left', 'arrow_right', 'arrow_up', 'arrow_down',
  // Controls
  'return', 'refresh', 'dots', 'plus', 'minus',
  // Status & Indicators
  'info', 'warning', 'question', 'check', 'x', 'circle',
  // System Icons & Tools
  'home', 'search', 'filter', 'trash', 'gear', 'layers', 'pencil', 'toggle_off', 'toggle_on',
  // Locks & Pointers
  'lock', 'unlock', 'tri_left', 'tri_right', 'tri_up', 'tri_down'
];

function loadEmojisView() {
  const grid = document.getElementById('emojisGrid');
  if (!grid) return;
  grid.innerHTML = customEmojiList.map(name => `
    <div class="emoji-card" onclick="copyEmojiCode(':${name}:')">
      <img src="assets/emojis/${name}.png" alt=":${name}:" class="emoji-card-img" onerror="this.src='assets/pack.png'" />
      <code>:${name}:</code>
    </div>
  `).join('');
}

function copyEmojiCode(code) {
  navigator.clipboard.writeText(code).then(() => {
    const toast = document.getElementById('emojiCopyStatus');
    if (!toast) return;
    toast.textContent = `Copied ${code} to clipboard!`;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 2000);
  }).catch(() => alert(`Failed to copy. Please manually copy: ${code}`));
}

/* ─────────── Projects View ─────────── */

/* ─────────── Projects View ─────────── */

function renderProjectCard(product) {
  const icon = product.icon_file
    ? `${apiUrl('/files/' + product.icon_file)}`
    : 'assets/pack.png';

  const premiumTag = product.is_premium
    ? `<span style="display: inline-block; padding: 2px 6px; border-radius: 4px; background: rgba(251, 191, 36, 0.15); color: #fbbf24; border: 1px solid rgba(251, 191, 36, 0.3); font-size: 0.8rem; font-weight: 800; margin-left: 6px;">$${Number(product.price || 0).toFixed(2)}</span>`
    : '';

  return `
    <div class="project-card" data-id="${product.id}">
      <div class="project-card-top">
        <img class="project-card-icon" src="${icon}" onerror="this.src='assets/pack.png'" alt="" />
        <div class="project-card-info">
          <span class="project-card-category">${escapeHtml(categoryIcons[product.category] || '⬢')} ${escapeHtml(categoryNames[product.category] || product.category)}</span>
          <h3>${parseEmojis(escapeHtml(product.title))}${premiumTag}</h3>
          <p>${parseEmojis(escapeHtml(product.short_description || ''))}</p>
        </div>
      </div>
      <div class="project-card-meta">
        <span>v${escapeHtml(product.version)}</span>
        <span>${escapeHtml(product.uploader || 'Admin')}</span>
        <span>${escapeHtml(timeAgo(product.created_at))}</span>
      </div>
      <div class="project-card-actions">
        <button class="btn btn-sm btn-outline" onclick="openEditProject(${product.id})">✎ Edit</button>
        <button class="btn btn-sm btn-outline" onclick="openVersions(${product.id})">⬢ Versions</button>
        <button class="btn btn-sm btn-danger-outline" onclick="deleteProject(${product.id})">✕ Delete</button>
      </div>
    </div>
  `;
}

let currentPremiumProductSearch = '';

async function loadProjects() {
  const grid = document.getElementById('projectsGrid');
  const premiumGrid = document.getElementById('premiumProjectsGrid');
  try {
    const { products } = await api('/api/admin/products');
    cachedProducts = products || [];
    renderProjectsList();
    renderPremiumProjectsList();
  } catch (error) {
    if (grid) grid.innerHTML = `<div class="admin-error"><h3>Could not load projects</h3><p>${escapeHtml(error.message)}</p></div>`;
    if (premiumGrid) premiumGrid.innerHTML = `<div class="admin-error"><h3>Could not load premium projects</h3><p>${escapeHtml(error.message)}</p></div>`;
  }
}

function renderProjectsList() {
  const grid = document.getElementById('projectsGrid');
  if (!grid) return;
  const query = currentProductSearch.toLowerCase();
  const filtered = cachedProducts.filter(p =>
    p.is_premium !== 1 &&
    (!query || p.title.toLowerCase().includes(query) || (p.category || '').toLowerCase().includes(query))
  );

  if (!filtered.length) {
    grid.innerHTML = `<div class="admin-empty"><h3>No free projects found</h3><p>${cachedProducts.some(p => p.is_premium !== 1) ? 'Try a different search.' : 'Click "+ Add Free Project" to create your first free project.'}</p></div>`;
    return;
  }

  grid.innerHTML = filtered.map(renderProjectCard).join('');
}

function renderPremiumProjectsList() {
  const grid = document.getElementById('premiumProjectsGrid');
  if (!grid) return;
  const query = currentPremiumProductSearch.toLowerCase();
  const filtered = cachedProducts.filter(p =>
    p.is_premium === 1 &&
    (!query || p.title.toLowerCase().includes(query) || (p.category || '').toLowerCase().includes(query))
  );

  if (!filtered.length) {
    grid.innerHTML = `<div class="admin-empty"><h3>No premium projects found</h3><p>${cachedProducts.some(p => p.is_premium === 1) ? 'Try a different search.' : 'Click "+ Add Premium Project" to create your first premium project.'}</p></div>`;
    return;
  }

  grid.innerHTML = filtered.map(renderProjectCard).join('');
}

// Project searches
document.getElementById('projectSearch')?.addEventListener('input', (e) => {
  currentProductSearch = e.target.value.trim();
  renderProjectsList();
});

document.getElementById('premiumProjectSearch')?.addEventListener('input', (e) => {
  currentPremiumProductSearch = e.target.value.trim();
  renderPremiumProjectsList();
});

/* ─────────── Add Project ─────────── */

function togglePremiumFields(isPremium) {
  const priceField = document.getElementById('priceFieldGroup');
  const urlField = document.getElementById('purchaseUrlFieldGroup');
  const priceInput = document.getElementById('projectPriceInput');
  const urlInput = document.getElementById('projectPurchaseUrlInput');
  const categorySelect = document.querySelector('#projectForm select[name="category"]');
  const modOption = categorySelect?.querySelector('option[value="mods"]');

  if (isPremium) {
    if (priceField) priceField.style.display = 'block';
    if (urlField) urlField.style.display = 'block';
    if (priceInput) priceInput.required = true;
    if (urlInput) urlInput.required = true;

    // Premium products can't be mods according to Mojang policies
    if (modOption) modOption.disabled = true;
    if (categorySelect && categorySelect.value === 'mods') {
      categorySelect.value = 'plugins';
    }
  } else {
    if (priceField) priceField.style.display = 'none';
    if (urlField) urlField.style.display = 'none';
    if (priceInput) {
      priceInput.required = false;
      priceInput.value = '';
    }
    if (urlInput) {
      urlInput.required = false;
      urlInput.value = '';
    }
    if (modOption) modOption.disabled = false;
  }
}

document.getElementById('projectIsPremiumInput')?.addEventListener('change', (e) => {
  togglePremiumFields(e.target.value === '1');
});

document.getElementById('addProjectBtn')?.addEventListener('click', () => {
  const form = document.getElementById('projectForm');
  form.reset();
  document.getElementById('editProjectId').value = '';
  document.getElementById('projectModalTitle').textContent = 'Create New Project';
  document.getElementById('submitProjectBtn').textContent = '+ Create Project';
  document.getElementById('initialVersionFields').style.display = '';
  document.getElementById('iconPreview').src = 'assets/pack.png';
  document.getElementById('projectStatus').textContent = '';

  const isPremiumInput = document.getElementById('projectIsPremiumInput');
  if (isPremiumInput) {
    isPremiumInput.value = '0';
    togglePremiumFields(false);
  }

  // Re-require files for new project
  const mainFile = document.getElementById('mainFileInput');
  const iconFile = document.getElementById('iconFileInput');
  if (mainFile) mainFile.required = true;
  if (iconFile) iconFile.required = true;

  openModal('projectModal');
});

document.getElementById('addPremiumProjectBtn')?.addEventListener('click', () => {
  const form = document.getElementById('projectForm');
  form.reset();
  document.getElementById('editProjectId').value = '';
  document.getElementById('projectModalTitle').textContent = 'Create Premium Project';
  document.getElementById('submitProjectBtn').textContent = '+ Create Premium Project';
  document.getElementById('initialVersionFields').style.display = '';
  document.getElementById('iconPreview').src = 'assets/pack.png';
  document.getElementById('projectStatus').textContent = '';

  const isPremiumInput = document.getElementById('projectIsPremiumInput');
  if (isPremiumInput) {
    isPremiumInput.value = '1';
    togglePremiumFields(true);
  }

  // Re-require files for new project
  const mainFile = document.getElementById('mainFileInput');
  const iconFile = document.getElementById('iconFileInput');
  if (mainFile) mainFile.required = true;
  if (iconFile) iconFile.required = true;

  openModal('projectModal');
});

document.getElementById('cancelProjectBtn')?.addEventListener('click', () => {
  closeModal('projectModal');
});

// Icon preview
document.getElementById('iconFileInput')?.addEventListener('change', (e) => {
  const file = e.target.files[0];
  if (file) {
    const reader = new FileReader();
    reader.onload = (ev) => {
      document.getElementById('iconPreview').src = ev.target.result;
    };
    reader.readAsDataURL(file);
  }
});

// Submit project form (create or edit)
document.getElementById('projectForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = e.currentTarget;
  const status = document.getElementById('projectStatus');
  const submitBtn = document.getElementById('submitProjectBtn');
  const editId = document.getElementById('editProjectId').value;

  if (form.isPremium.value === '1' && form.category.value === 'mods') {
    alert('Minecraft Mods cannot be premium according to Mojang policies.');
    return;
  }

  status.textContent = editId ? 'Saving...' : 'Uploading...';
  status.style.color = 'var(--soft)';
  submitBtn.disabled = true;

  try {
    if (editId) {
      // Edit existing project (FormData with optional icon file)
      const formData = new FormData(form);
      formData.delete('editId');

      const res = await fetch(apiUrl(`/api/admin/products/${editId}`), {
        method: 'PATCH',
        credentials: 'include',
        body: formData
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Update failed');

      status.textContent = 'Project updated successfully.';
      status.style.color = '#4ade80';
      await loadProjects();
      setTimeout(() => closeModal('projectModal'), 800);
    } else {
      // Create new project (FormData with file)
      const formData = new FormData(form);

      // Collect checkbox values
      const loaders = [...form.querySelectorAll('input[name="loaders"]:checked')].map(c => c.value);
      const platforms = [...form.querySelectorAll('input[name="platforms"]:checked')].map(c => c.value);
      const environments = [...form.querySelectorAll('input[name="environments"]:checked')].map(c => c.value);

      // Remove individual checkbox entries and set as CSV
      formData.delete('loaders');
      formData.delete('platforms');
      formData.delete('environments');
      formData.set('loaders', loaders.join(','));
      formData.set('platforms', platforms.join(','));
      formData.set('environments', environments.join(','));

      const res = await fetch(apiUrl('/api/admin/products'), {
        method: 'POST',
        credentials: 'include',
        body: formData
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'Upload failed');

      status.textContent = 'Project created successfully!';
      status.style.color = '#4ade80';
      form.reset();
      document.getElementById('iconPreview').src = 'assets/pack.png';
      await loadProjects();
      setTimeout(() => closeModal('projectModal'), 800);
    }
  } catch (error) {
    status.textContent = error.message;
    status.style.color = '#ff9b9b';
  } finally {
    submitBtn.disabled = false;
  }
});

/* ─────────── Edit Project ─────────── */

async function openEditProject(id) {
  const product = cachedProducts.find(p => p.id === id);
  if (!product) return alert('Product not found.');

  const form = document.getElementById('projectForm');
  document.getElementById('editProjectId').value = id;
  document.getElementById('projectModalTitle').textContent = 'Edit Project';
  document.getElementById('submitProjectBtn').textContent = 'Save Changes';
  document.getElementById('initialVersionFields').style.display = 'none';
  document.getElementById('projectStatus').textContent = '';

  // Don't require files for edit
  const mainFile = document.getElementById('mainFileInput');
  const iconFile = document.getElementById('iconFileInput');
  if (mainFile) mainFile.required = false;
  if (iconFile) iconFile.required = false;

  // Fill form fields
  form.title.value = product.title || '';
  form.category.value = product.category || 'plugins';
  form.shortDescription.value = product.short_description || '';
  form.description.value = product.description || '';
  form.license.value = product.license || 'proprietary';

  // Premium fields
  const isPremiumVal = product.is_premium === 1;
  const isPremiumInput = document.getElementById('projectIsPremiumInput');
  if (isPremiumInput) {
    isPremiumInput.value = isPremiumVal ? '1' : '0';
  }
  togglePremiumFields(isPremiumVal);

  if (form.price) form.price.value = product.price !== null ? product.price : '';
  if (form.purchaseUrl) form.purchaseUrl.value = product.purchase_url || '';

  // Icon preview
  const iconUrl = product.icon_file ? apiUrl('/files/' + product.icon_file) : 'assets/pack.png';
  document.getElementById('iconPreview').src = iconUrl;

  openModal('projectModal');
}

/* ─────────── Delete Project ─────────── */

async function deleteProject(id) {
  const product = cachedProducts.find(p => p.id === id);
  if (!product) return;

  if (!confirm(`Delete "${product.title}"?\n\nThis will permanently remove the project and all its versions.`)) return;

  try {
    await api(`/api/admin/products/${id}`, { method: 'DELETE' });
    await loadProjects();
  } catch (error) {
    alert(error.message);
  }
}

/* ─────────── Version Management ─────────── */

let currentVersionsProductId = null;

async function openVersions(productId) {
  currentVersionsProductId = productId;
  const product = cachedProducts.find(p => p.id === productId);
  if (!product) return;

  document.getElementById('versionsModalTitle').textContent = `Versions — ${product.title}`;
  document.getElementById('versionsModalSub').textContent = `Manage versions for ${product.title}`;
  document.getElementById('versionProductId').value = productId;
  document.getElementById('versionStatus').textContent = '';
  document.getElementById('addVersionForm').reset();

  openModal('versionsModal');
  await loadVersionsList(productId);
}

async function loadVersionsList(productId) {
  const container = document.getElementById('versionsList');
  container.innerHTML = '<div class="admin-loading">Loading versions...</div>';

  try {
    const data = await api(`/api/products/${productId}`);
    const versions = data.versions || [];

    if (!versions.length) {
      container.innerHTML = '<div class="admin-empty"><p>No versions yet. Add one below.</p></div>';
      return;
    }

    container.innerHTML = versions.map(v => {
      const loaders = (v.loaders || []).map(l => {
        const map = { paper: 'Paper', spigot: 'Spigot', fabric: 'Fabric', forge: 'Forge' };
        return map[l] || l;
      });
      const mcVersions = v.minecraft_versions || [];

      return `
        <div class="version-item">
          <div class="version-item-info">
            <div class="version-item-header">
              <strong>${escapeHtml(v.version_name)}</strong>
              <span class="version-item-mc">${escapeHtml(mcVersions.join(', '))}</span>
            </div>
            <div class="version-item-meta">
              <span>${escapeHtml(loaders.join(', ') || '—')}</span>
              <span>${formatSize(v.file_size)}</span>
              <span>${Number(v.downloads || 0)} downloads</span>
              <span>${escapeHtml(timeAgo(v.created_at))}</span>
            </div>
            ${v.changelog ? `<p class="version-item-changelog">${parseEmojis(escapeHtml(v.changelog))}</p>` : ''}
          </div>
          <div class="version-item-actions">
            <button class="btn btn-sm btn-outline" onclick="openEditVersion(${v.id}, ${JSON.stringify(escapeHtml(JSON.stringify(v)))})">Edit</button>
            <button class="btn btn-sm btn-danger-outline" onclick="deleteVersion(${v.id})">Delete</button>
          </div>
        </div>
      `;
    }).join('');
  } catch (error) {
    container.innerHTML = `<div class="admin-error"><p>${escapeHtml(error.message)}</p></div>`;
  }
}

// Add new version
document.getElementById('addVersionForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = e.currentTarget;
  const status = document.getElementById('versionStatus');
  const productId = document.getElementById('versionProductId').value;

  status.textContent = 'Uploading version...';
  status.style.color = 'var(--soft)';

  try {
    const formData = new FormData(form);

    const loaders = [...form.querySelectorAll('input[name="loaders"]:checked')].map(c => c.value);
    const platforms = [...form.querySelectorAll('input[name="platforms"]:checked')].map(c => c.value);
    const environments = [...form.querySelectorAll('input[name="environments"]:checked')].map(c => c.value);

    formData.delete('loaders');
    formData.delete('platforms');
    formData.delete('environments');
    formData.delete('productId');
    formData.set('loaders', loaders.join(','));
    formData.set('platforms', platforms.join(','));
    formData.set('environments', environments.join(','));

    const res = await fetch(apiUrl(`/api/admin/products/${productId}/versions`), {
      method: 'POST',
      credentials: 'include',
      body: formData
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Upload failed');

    status.textContent = 'Version added successfully!';
    status.style.color = '#4ade80';
    form.reset();
    document.getElementById('versionProductId').value = productId;
    await loadVersionsList(Number(productId));
    await loadProjects();
  } catch (error) {
    status.textContent = error.message;
    status.style.color = '#ff9b9b';
  }
});

// Open edit version modal
function openEditVersion(versionId, escapedJson) {
  try {
    const raw = document.createElement('textarea');
    raw.innerHTML = escapedJson;
    const v = JSON.parse(raw.value);

    document.getElementById('editVersionId').value = versionId;
    document.getElementById('editVersionName').value = v.version_name || '';
    document.getElementById('editMcVersions').value = (v.minecraft_versions || []).join(', ');
    document.getElementById('editVersionChangelog').value = v.changelog || '';
    document.getElementById('editVersionStatus').textContent = '';

    // Set loader checkboxes
    const loaders = v.loaders || [];
    document.querySelectorAll('#editVersionLoaders input[type="checkbox"]').forEach(cb => {
      cb.checked = loaders.includes(cb.value);
    });

    // Set platform checkboxes
    const platforms = v.platforms || [];
    document.querySelectorAll('#editVersionPlatforms input[type="checkbox"]').forEach(cb => {
      cb.checked = platforms.includes(cb.value);
    });

    // Set environment checkboxes
    const environments = v.environments || [];
    document.querySelectorAll('#editVersionEnvironments input[type="checkbox"]').forEach(cb => {
      cb.checked = environments.includes(cb.value);
    });

    // Clear file input
    const fileInput = document.getElementById('editVersionFile');
    if (fileInput) fileInput.value = '';

    openModal('editVersionModal');
  } catch (error) {
    alert('Could not parse version data.');
  }
}

// Submit edit version
document.getElementById('editVersionForm')?.addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = e.currentTarget;
  const status = document.getElementById('editVersionStatus');
  const versionId = document.getElementById('editVersionId').value;

  status.textContent = 'Saving...';
  status.style.color = 'var(--soft)';

  try {
    const loaders = [...form.querySelectorAll('input[name="loaders"]:checked')].map(c => c.value);
    const platforms = [...form.querySelectorAll('input[name="platforms"]:checked')].map(c => c.value);
    const environments = [...form.querySelectorAll('input[name="environments"]:checked')].map(c => c.value);

    // Update version metadata
    await api(`/api/admin/versions/${versionId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        versionName: form.versionName.value,
        minecraftVersions: form.minecraftVersions.value,
        loaders: loaders.join(','),
        platforms: platforms.join(','),
        environments: environments.join(','),
        changelog: form.changelog.value
      })
    });

    // Replace file if one was selected
    const fileInput = document.getElementById('editVersionFile');
    if (fileInput?.files?.length) {
      const fileData = new FormData();
      fileData.append('file', fileInput.files[0]);
      const res = await fetch(apiUrl(`/api/admin/versions/${versionId}/replace-file`), {
        method: 'POST',
        credentials: 'include',
        body: fileData
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || 'File replacement failed');
    }

    status.textContent = 'Version updated!';
    status.style.color = '#4ade80';

    if (currentVersionsProductId) {
      await loadVersionsList(currentVersionsProductId);
    }
    await loadProjects();
    setTimeout(() => closeModal('editVersionModal'), 600);
  } catch (error) {
    status.textContent = error.message;
    status.style.color = '#ff9b9b';
  }
});

// Delete version
async function deleteVersion(versionId) {
  if (!confirm('Delete this version? The file will also be removed.')) return;

  try {
    await api(`/api/admin/versions/${versionId}`, { method: 'DELETE' });
    if (currentVersionsProductId) {
      await loadVersionsList(currentVersionsProductId);
    }
    await loadProjects();
  } catch (error) {
    alert(error.message);
  }
}

/* ─────────── Analytics View ─────────── */

async function loadAnalytics() {
  try {
    const [{ users }, { downloads }, { activity }, { products }] = await Promise.all([
      api('/api/admin/users'),
      api('/api/admin/downloads'),
      api('/api/admin/activity'),
      api('/api/admin/products')
    ]);

    document.getElementById('statUsers').textContent = users.length;
    document.getElementById('statDownloads').textContent = downloads.length;
    document.getElementById('statProducts').textContent = products.length;
    document.getElementById('statActivity').textContent = activity.length;

    document.getElementById('usersTable').innerHTML = table(
      ['Avatar', 'Username', 'Email', 'Role', 'Created', 'Last Login'],
      users.map(u => [
        `<img class="avatar-small" src="${u.avatarUrl}" onerror="this.src='assets/pack.png'">`,
        escapeHtml(u.username),
        escapeHtml(u.email),
        `<span class="role-badge role-${u.role}">${escapeHtml(u.role)}</span>`,
        escapeHtml(timeAgo(u.createdAt)),
        u.lastLoginAt ? escapeHtml(timeAgo(u.lastLoginAt)) : '—'
      ])
    );

    document.getElementById('downloadsTable').innerHTML = table(
      ['User', 'Item', 'Type', 'Date'],
      downloads.slice(0, 50).map(d => [
        escapeHtml(d.username || 'Guest'),
        escapeHtml(d.item),
        escapeHtml(d.type),
        escapeHtml(timeAgo(d.created_at))
      ])
    );

    document.getElementById('activityTable').innerHTML = table(
      ['User', 'Action', 'Details', 'Date'],
      activity.slice(0, 50).map(a => [
        escapeHtml(a.username || 'Guest'),
        `<span class="activity-action">${escapeHtml(a.action)}</span>`,
        escapeHtml(a.details),
        escapeHtml(timeAgo(a.created_at))
      ])
    );
  } catch (error) {
    console.error('Analytics load failed:', error);
  }
}

/* ─────────── Init ─────────── */

async function init() {
  try {
    const me = await api('/api/auth/me');
    if (!me.user || me.user.role !== 'admin') {
      location.href = 'index.html';
      return;
    }
    await loadProjects();
  } catch (error) {
    document.querySelector('.admin-main').innerHTML = `
      <section class="admin-view active">
        <div class="admin-error">
          <h1>Admin Access Required</h1>
          <p>${escapeHtml(error.message)}</p>
          <a class="btn btn-primary" href="index.html">Back to Website</a>
        </div>
      </section>
    `;
  }
}

document.getElementById('logoutBtn')?.addEventListener('click', async () => {
  await api('/api/auth/logout', { method: 'POST' });
  location.href = 'index.html';
});

// Make functions available globally for inline onclick handlers
window.openEditProject = openEditProject;
window.deleteProject = deleteProduct = deleteProject;
window.openVersions = openVersions;
window.openEditVersion = openEditVersion;
window.deleteVersion = deleteVersion;
window.closeModal = closeModal;
window.copyEmojiCode = copyEmojiCode;
window.setWebsiteTheme = setWebsiteTheme;

init();
