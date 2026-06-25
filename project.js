const API_BASE = (window.OBSIDIAN_API_URL || '').replace(/\/$/, '');
const apiUrl = (path) => `${API_BASE}${path}`;
const id = new URLSearchParams(location.search).get('id');

function escapeHtml(value) {
  return String(value || '').replace(/[&<>'"]/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;'
  }[character]));
}

function formatSize(bytes) {
  let size = Number(bytes || 0);
  const units = ['B', 'KB', 'MB', 'GB'];
  let unit = 0;
  while (size > 1024 && unit < units.length - 1) { size /= 1024; unit++; }
  return `${size.toFixed(unit ? 1 : 0)} ${units[unit]}`;
}

function loaderLabel(value) {
  const map = { paper: 'Paper', spigot: 'Spigot', fabric: 'Fabric', forge: 'Forge' };
  return map[value] || value;
}

function platformLabel(value) {
  const map = { bungeecord: 'BungeeCord', geyser: 'Geyser Extension', velocity: 'Velocity', waterfall: 'Waterfall' };
  return map[value] || value;
}

function environmentLabel(value) {
  const map = { client: 'Client', server: 'Server' };
  return map[value] || value;
}

function licenseLabel(value) {
  return value === 'open_source' ? 'Open source' : 'Proprietary';
}

let projectVersions = [];
let selectedVersionId = null;
let selectedLoader = null;

const iconMap = {
  paper: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>`,
  spigot: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22a7 7 0 0 0 7-7c0-4.3-7-11-7-11S5 10.7 5 15a7 7 0 0 0 7 7z"/></svg>`,
  fabric: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4a2 2 0 0 0 1-1.73z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" x2="12" y1="22.08" y2="12"/></svg>`,
  forge: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m15 5 4 4M21.5 2.5a2.12 2.12 0 0 1 0 3L12 15l-4-4 9.5-9.5a2.12 2.12 0 0 1 3 0Z"/><path d="M7 16 3 20c-.5.5-1.5.5-2 0s-.5-1.5 0-2l4-4"/></svg>`,
  bungeecord: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z"/><path d="M12 6v12M6 12h12"/></svg>`,
  velocity: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg>`
};

function getOptionIcon(value) {
  return iconMap[value] || `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="20" height="12" x="2" y="6" rx="2"/><circle cx="12" cy="12" r="2"/></svg>`;
}

async function loadProject() {
  const hero = document.getElementById('projectHero');
  const overview = document.getElementById('overview');
  const versionsBox = document.getElementById('versions');
  const changelogBox = document.getElementById('changelog');

  try {
    const response = await fetch(apiUrl(`/api/products/${id}`), { credentials: 'include' });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || 'Project not found');

    const { product, versions } = data;
    projectVersions = versions || [];
    document.title = `${product.title} — Azor Studios`;

    const allLoaders = [...new Set(versions.flatMap((v) => v.loaders || []))];
    const allPlatforms = [...new Set(versions.flatMap((v) => v.platforms || []))];
    const allEnvironments = [...new Set(versions.flatMap((v) => v.environments || []))];

    const purchaseUrl = product.purchase_url ? (product.purchase_url.startsWith('http') ? product.purchase_url : 'https://' + product.purchase_url) : '#';

    let actionBtnHtml = '';
    if (product.is_premium) {
      actionBtnHtml = `
        <a class="buy-btn" href="${escapeHtml(purchaseUrl)}" target="_blank" style="padding: 14px 24px; font-size: 1.1rem;">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>
          Buy — $${Number(product.price || 0).toFixed(2)}
        </a>
      `;
    } else {
      actionBtnHtml = `
        <button class="primary-btn download-hero-btn" id="downloadHeroBtn" style="padding: 14px 24px; font-size: 1.1rem; font-weight: 900; display: inline-flex; align-items: center; gap: 8px;">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>
          Download
        </button>
      `;
    }

    hero.innerHTML = `
      <img class="project-page-icon" src="${product.icon_url || 'assets/pack.png'}" alt="">
      <div>
        <span class="market-type">${escapeHtml(product.category)}</span>
        <h1>${escapeHtml(product.title)}</h1>
        <p>${escapeHtml(product.short_description)}</p>
        <div class="project-meta">
          <span>By ${escapeHtml(product.author || product.uploader || 'Azor Studios')}</span>
          <span>${Number(product.downloads || 0)} downloads</span>
          <span>${versions.length} version(s)</span>
          <span>${escapeHtml(licenseLabel(product.license))}</span>
        </div>
        <div class="project-meta">
          ${allLoaders.map((l) => `<span class="tag-chip">${escapeHtml(loaderLabel(l))}</span>`).join('')}
          ${allPlatforms.map((p) => `<span class="tag-chip">${escapeHtml(platformLabel(p))}</span>`).join('')}
          ${allEnvironments.map((e) => `<span class="tag-chip">${escapeHtml(environmentLabel(e))}</span>`).join('')}
        </div>
      </div>
      <div class="project-hero-actions">
        ${actionBtnHtml}
      </div>
    `;

    overview.innerHTML = `
      <div class="market-card">
        <h3>Overview</h3>
        <p>${escapeHtml(product.description || product.short_description || 'No description provided.')}</p>
      </div>
    `;

    versionsBox.innerHTML = `
      <div class="version-table">
        <div class="version-row version-head">
          <span>Minecraft Version</span><span>Plugin Version</span><span>Loader / Platform</span><span>Upload Date</span><span>Downloads</span><span></span>
        </div>
        ${versions.map((version) => {
          const versionTags = [
            ...(version.loaders || []).map(loaderLabel),
            ...(version.platforms || []).map(platformLabel)
          ];
          const actionBtn = product.is_premium
            ? `<a class="buy-btn" href="${escapeHtml(purchaseUrl)}" target="_blank" style="padding: 8px 16px; font-size: 0.85rem; border-radius: 8px;">Buy</a>`
            : `<a class="primary-btn" href="${apiUrl(`/download/version/${version.id}`)}">Download</a>`;
          return `
          <div class="version-row">
            <span>${escapeHtml((version.minecraft_versions && version.minecraft_versions[0]) || version.minecraft_version)}</span>
            <span>${escapeHtml(version.version_name)}</span>
            <span>${versionTags.map((t) => `<span class="tag-chip">${escapeHtml(t)}</span>`).join(' ') || '—'}</span>
            <span>${new Date(version.created_at).toLocaleDateString()}</span>
            <span>${Number(version.downloads || 0)}</span>
            ${actionBtn}
          </div>
        `;
        }).join('')}
      </div>
    `;

    changelogBox.innerHTML = `
      <div class="market-card">
        <h3>Changelog</h3>
        ${versions.map((version) => `<p><b>${escapeHtml(version.version_name)}</b><br>${escapeHtml(version.changelog || 'No changelog provided.')}</p>`).join('')}
      </div>
    `;

    if (!product.is_premium) {
      document.getElementById('downloadHeroBtn')?.addEventListener('click', handleDownloadClick);
    }
  } catch (error) {
    hero.innerHTML = `<div class="market-card"><h3>Could not load project</h3><p>${escapeHtml(error.message)}</p></div>`;
  }
}

function handleDownloadClick() {
  if (projectVersions.length === 0) {
    alert('No versions available for download.');
    return;
  }

  // If there is only one version AND it supports 0 or 1 loader/platform, download it directly
  if (projectVersions.length === 1) {
    const singleVer = projectVersions[0];
    const totalOptions = (singleVer.loaders || []).length + (singleVer.platforms || []).length;
    if (totalOptions <= 1) {
      location.href = apiUrl(`/download/version/${singleVer.id}`);
      return;
    }
  }

  // Otherwise, open the selection modal
  openDownloadModal();
}

function openDownloadModal() {
  const modal = document.getElementById('downloadModal');
  const select = document.getElementById('downloadVersionSelect');
  
  if (!modal || !select) return;

  // Populate version options
  select.innerHTML = projectVersions.map((v, idx) => {
    return `<option value="${v.id}" ${idx === 0 ? 'selected' : ''}>${escapeHtml(v.version_name)} (MC ${escapeHtml((v.minecraft_versions && v.minecraft_versions[0]) || v.minecraft_version)})</option>`;
  }).join('');

  // Handle version change to update loaders
  select.addEventListener('change', () => {
    updateLoaderSelectionOptions(Number(select.value));
  });

  // Initial update
  updateLoaderSelectionOptions(Number(select.value));

  modal.classList.add('open');
}

function updateLoaderSelectionOptions(versionId) {
  selectedVersionId = versionId;
  selectedLoader = null;

  const version = projectVersions.find((v) => v.id === versionId);
  const selectionGroup = document.getElementById('loaderSelectionGroup');
  const optionsGrid = document.getElementById('loaderOptionsGrid');

  if (!version || !selectionGroup || !optionsGrid) return;

  // Combine loaders and platforms for selections
  const options = [...(version.loaders || []), ...(version.platforms || [])];

  if (options.length > 1) {
    selectionGroup.style.display = 'block';
    optionsGrid.innerHTML = options.map((opt) => {
      const isSelected = selectedLoader === opt;
      return `
        <div class="loader-pill-option ${isSelected ? 'active' : ''}" data-value="${opt}">
          ${getOptionIcon(opt)}
          <span>${escapeHtml(loaderLabel(opt))}</span>
        </div>
      `;
    }).join('');

    // Add click listeners to selector cards
    optionsGrid.querySelectorAll('.loader-pill-option').forEach((pill) => {
      pill.addEventListener('click', () => {
        optionsGrid.querySelectorAll('.loader-pill-option').forEach((p) => p.classList.remove('active'));
        pill.classList.add('active');
        selectedLoader = pill.dataset.value;
      });
    });
  } else {
    selectionGroup.style.display = 'none';
  }
}

// Confirm download button listener
document.getElementById('confirmDownloadBtn')?.addEventListener('click', () => {
  const select = document.getElementById('downloadVersionSelect');
  const versionId = select ? Number(select.value) : selectedVersionId;
  const version = projectVersions.find((v) => v.id === versionId);

  if (!version) {
    alert('Please select a valid version.');
    return;
  }

  const options = [...(version.loaders || []), ...(version.platforms || [])];
  if (options.length > 1 && !selectedLoader) {
    alert('Please select which loader/platform you want to download for.');
    return;
  }

  // Close modal & trigger download link redirect
  closeModals();
  location.href = apiUrl(`/download/version/${versionId}`);
});

document.querySelectorAll('.project-tabs button').forEach((button) => {
  button.addEventListener('click', () => {
    document.querySelectorAll('.project-tabs button').forEach((item) => item.classList.remove('active'));
    document.querySelectorAll('.project-tab').forEach((item) => item.classList.remove('active'));
    button.classList.add('active');
    document.getElementById(button.dataset.tab)?.classList.add('active');
  });
});

loadProject();
