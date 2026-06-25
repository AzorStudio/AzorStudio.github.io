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
    document.title = `${product.title} — Azor Studios`;

    // Loaders/platforms/environments aren't on the product row itself (they live per-version),
    // so aggregate the unique values across all versions for the hero badges.
    const allLoaders = [...new Set(versions.flatMap((v) => v.loaders || []))];
    const allPlatforms = [...new Set(versions.flatMap((v) => v.platforms || []))];
    const allEnvironments = [...new Set(versions.flatMap((v) => v.environments || []))];

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
          return `
          <div class="version-row">
            <span>${escapeHtml((version.minecraft_versions && version.minecraft_versions[0]) || version.minecraft_version)}</span>
            <span>${escapeHtml(version.version_name)}</span>
            <span>${versionTags.map((t) => `<span class="tag-chip">${escapeHtml(t)}</span>`).join(' ') || '—'}</span>
            <span>${new Date(version.created_at).toLocaleDateString()}</span>
            <span>${Number(version.downloads || 0)}</span>
            <a class="primary-btn" href="${apiUrl(`/download/version/${version.id}`)}">Download</a>
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
  } catch (error) {
    hero.innerHTML = `<div class="market-card"><h3>Could not load project</h3><p>${escapeHtml(error.message)}</p></div>`;
  }
}

document.querySelectorAll('.project-tabs button').forEach((button) => {
  button.addEventListener('click', () => {
    document.querySelectorAll('.project-tabs button').forEach((item) => item.classList.remove('active'));
    document.querySelectorAll('.project-tab').forEach((item) => item.classList.remove('active'));
    button.classList.add('active');
    document.getElementById(button.dataset.tab)?.classList.add('active');
  });
});

loadProject();
